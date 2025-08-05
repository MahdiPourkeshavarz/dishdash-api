/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { UploadsService } from './uploads/uploads.service';
import { Readable } from 'stream';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly uploadsService: UploadsService) {}

  onModuleInit() {
    console.log('Warming up the embedding model...');
    this.uploadsService
      .generateEmbedding('warm up')
      .then(() => console.log('Embedding model warmed up successfully.'))
      .catch((err) =>
        console.error(
          'Embedding model warm-up failed (this is non-critical):',
          err.message,
        ),
      );

    console.log('Warming up the image classification model...');

    const placeholderImageBuffer = Buffer.from(
      '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwn/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwB1A4f/2Q==',
      'base64',
    );

    const mockFile: Express.Multer.File = {
      fieldname: 'warmup',
      originalname: 'warmup.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: placeholderImageBuffer.length,
      buffer: placeholderImageBuffer,
      stream: Readable.from(placeholderImageBuffer),
      destination: '',
      filename: '',
      path: '',
    };

    this.uploadsService
      .classifyImage(mockFile)
      .then(() =>
        console.log('Image classification model warmed up successfully.'),
      )
      .catch((err) =>
        console.error(
          'Image classification model warm-up failed (this is non-critical):',
          err.message,
        ),
      );
  }

  getHello(): string {
    return 'Hello World!';
  }
}
