# Simple Blog Backend

This is an example blog backend which supports an admin frontend (with authentication) and public frontend.

- [The app]() was created using Node.js, Express, and SQL (utilizing a POSTGRES database).
- It utilizes [Passport.js](https://passportjs.org/) header authentication using a username and password combination.
- It also uses [uuid](https://www.npmjs.com/package/uuid) for ID creation for blog posts and comments.
- Passwords are stored after hashing them with bcryptjs.

## Installation

Use [node and node package manager](https://nodejs.org/en/) in order to install prerequisites and run the server.
After setting up the .env file (look below) for [dotenv](https://www.npmjs.com/package/dotenv) put the following in the command line:

```bash
npm install
npm run serverstart
```

## Usage

To run this server, you will need to have a postgres server and be able to create a .env file.
Inside the .env file, you will need to include these settings:
```bash
SECRET=[JWT Signing Secret]
PGHOST=[Hostname of the PostgreSQL Server]
PGUSER=[User for the PostgreSQL Server]
PGPASSWORD=[Password for the PostgreSQL Server]
PGPORT=[Port for the PostgreSQL Server]
PGDATABASE=[Name of the database in the PostgreSQL Server]
SECRETUUID=[Your company\'s secret UUID]
```
