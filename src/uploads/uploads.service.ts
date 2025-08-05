/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadsService {
  constructor(private configService: ConfigService) {}
  async saveFile(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new InternalServerErrorException('No file provided');
    }

    try {
      const uploadPath = join(process.cwd(), 'uploads');
      const extension = file.mimetype.split('/')[1] || 'jpg';
      const uniqueFilename = `${uuidv4()}.${extension}`;
      await writeFile(join(uploadPath, uniqueFilename), file.buffer);

      const baseUrl = process.env.API_BASE_URL || 'http://localhost:8000';
      const url = `${baseUrl}/uploads/${uniqueFilename}`;
      console.log('Saved file URL:', url);
      return { url };
    } catch (error) {
      console.error('Error saving file:', error);
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
      'https://api-inference.huggingface.co/models/microsoft/beit-base-patch16-224-pt22k-ft22k';

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

  async generateEmbedding(text: string): Promise<number[]> {
    const apiToken = this.configService.get('HUGGING_FACE_API_TOKEN');
    const apiUrl =
      'https://api-inference.huggingface.co/models/intfloat/multilingual-e5-large';
    const inputText = `passage: ${text}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputText,
        options: { wait_for_model: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API Error:', errorText);
      throw new HttpException(
        `Hugging Face API error: ${errorText}`,
        response.status,
      );
    }

    const result = await response.json();

    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result[0];
    }
    if (Array.isArray(result) && typeof result[0] === 'number') {
      return result;
    }

    console.error('Unexpected embedding format from API:', result);
    throw new InternalServerErrorException(
      'Unexpected embedding format from API.',
    );
  }
}
