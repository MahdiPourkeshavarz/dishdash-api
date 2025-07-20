# DishDash API 🍔

This is the official backend API for the DishDash application, a modern, map-based platform for discovering and sharing food experiences. Built with **NestJS**, **TypeScript**, and **TypeORM**, this API provides a robust, scalable, and secure foundation for both the web and mobile versions of DishDash.

The architecture is modular, with a clear separation of concerns to ensure the codebase is clean, maintainable, and easy to extend.

---

## ✨ Core Features

- **Secure JWT Authentication**: Handles user sign-in and sign-up with a secure, token-based session system using **Passport.js**.
- **Modular Architecture**: Code is organized by feature (`Auth`, `Users`, `Posts`, etc.), making the project easy to navigate and scale.
- **Database Integration**: Uses **TypeORM** to connect to a **MongoDB** database, with clearly defined entities and relationships.
- **CRUD Operations**: Provides a full suite of API endpoints for managing users, posts, and interactions.
- **File Uploads**: A dedicated module for handling image uploads (for profiles and posts) to a local storage provider.
- **Social Interactions**: Includes logic for liking/disliking posts and managing user wishlists.
- **External API Proxy**: A dedicated service for fetching and caching Point of Interest (POI) data from the **OpenStreetMap Overpass API**.
- **Validation**: Uses DTOs (Data Transfer Objects) with `class-validator` to ensure all incoming requests are type-safe and have the correct data.

---

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [MongoDB](https://www.mongodb.com/) (with [MongoDB Atlas](https://www.mongodb.com/atlas) for cloud hosting)
- **ORM / ODM**: [TypeORM](https://typeorm.io/)
- **Authentication**: [Passport.js](http://www.passportjs.org/) with JWT (`passport-jwt`) and Local (`passport-local`) strategies.
- **Validation**: [class-validator](https://github.com/typestack/class-validator)
- **File Handling**: [Multer](https://github.com/expressjs/multer) via `@nestjs/platform-express`
- **Password Hashing**: [bcrypt](https://www.google.com/search?q=https://github.com/kelektiv/node.bcrypt.js)

---

## 🚀 Getting Started

### 1\. Prerequisites

- Node.js (v18 or later)
- npm, yarn, or pnpm
- A running MongoDB Atlas cluster

### 2\. Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MahdiPourkeshavarz/dishdash-api.git
    cd dishdash-api
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### 3\. Environment Configuration

1.  Create a `.env` file in the root of the project.

2.  Add the following required environment variables:

    ```env
    # The port your NestJS server will run on
    PORT=3001

    # Your full MongoDB Atlas connection string
    DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/your_db?retryWrites=true&w=majority

    # A long, random string for signing JWTs
    # Generate one with: openssl rand -base64 32
    JWT_SECRET=your-super-secret-key-goes-here
    JWT_ACCESS_TOKEN_EXPIRES_IN=60m
    ```

### 4\. Running the Application

- **Development mode:**
  ```bash
  npm run start:dev
  ```
- **Production mode:**
  ```bash
  npm run build
  npm run start:prod
  ```

The API will be available at `http://localhost:3001`.

---

## 📁 API Structure

The project is organized into self-contained modules for each feature.

```
/src
├── auth/           # Handles JWT creation, login/signup, and guards
├── interactions/   # Manages likes, dislikes, and wishlists
├── places/         # Fetches POI data from the Overpass API
├── posts/          # All CRUD logic for posts
├── uploads/        # Handles image file saving
├── users/          # Manages user profiles and data
│
├── app.module.ts   # The root module of the application
└── main.ts         # The main entry point of the application
```

Each module typically contains a `controller`, `service`, `module`, and an `entities` sub-folder.
