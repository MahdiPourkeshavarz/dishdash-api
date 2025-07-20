/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile } from 'fs/promises';
import { join } from 'path';

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
    const apiUrl =
      'https://api-inference.huggingface.co/models/google/vit-base-patch16-224-in21k';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': file.mimetype,
      },
      body: file.buffer,
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        'Failed to classify image with Hugging Face API',
      );
    }

    const result = await response.json();
    return result;
  }
}
