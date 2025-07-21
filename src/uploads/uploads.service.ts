/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import * as sharp from 'sharp';

@Injectable()
export class UploadsService {
  constructor(private configService: ConfigService) {}
  async saveFile(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new InternalServerErrorException('No file provided');
    }

    try {
      const uploadPath = join(process.cwd(), 'uploads');
      const uniqueFilename = `${Date.now()}-${file.originalname}`;
      await writeFile(join(uploadPath, uniqueFilename), file.buffer);

      const url = `/uploads/${uniqueFilename}`;
      return { url };
    } catch (error) {
      throw new InternalServerErrorException('Failed to save file');
    }
  }

  async classifyImage(file: Express.Multer.File): Promise<any> {
    const apiToken = this.configService.get('HUGGING_FACE_API_TOKEN');
    if (!apiToken) {
      throw new HttpException(
        'HUGGING_FACE_API_TOKEN is not defined',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const supportedMimeTypes = ['image/jpeg', 'image/png'];
    let contentType = file.mimetype;
    if (file.mimetype === 'image/jpg') {
      contentType = 'image/jpeg';
    }
    if (!supportedMimeTypes.includes(contentType)) {
      throw new HttpException(
        `Unsupported file type: ${file.mimetype}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new HttpException(
        'Invalid or empty image file',
        HttpStatus.BAD_REQUEST,
      );
    }

    let imageBuffer = file.buffer;
    try {
      imageBuffer = await sharp(file.buffer).toFormat('jpeg').toBuffer();
      contentType = 'image/jpeg';
    } catch (error) {
      throw new HttpException(
        `Invalid image: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const apiUrl =
      'https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': contentType,
        },
        body: imageBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', response.status, errorText);
        if (response.status === 503) {
          const errorData = JSON.parse(errorText);
          const estimatedTime = errorData.estimated_time || 20;
          throw new HttpException(
            `AI model is currently loading. Please try again in ${Math.ceil(estimatedTime)} seconds.`,
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        throw new HttpException(
          `Hugging Face API error: ${response.status} - ${errorText}`,
          response.status,
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException(
          'Request timed out',
          HttpStatus.REQUEST_TIMEOUT,
        );
      }
      throw error;
    }
  }
}
