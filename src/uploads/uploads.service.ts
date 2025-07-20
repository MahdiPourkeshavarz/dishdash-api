/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class UploadsService {
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
}
