import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { UploadsModule } from './uploads/uploads.module';
import { InteractionsModule } from './interactions/interactions.module';
import { PlacesModule } from './places/places.module';

@Module({
  imports: [AuthModule, UsersModule, PostsModule, UploadsModule, InteractionsModule, PlacesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
