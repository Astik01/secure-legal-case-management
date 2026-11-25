import mongoose from 'mongoose';
import request from 'supertest';
import { Express } from 'express';
import { connectDb, disconnectDb } from '../src/config/db';
import { User } from '../src/models/User';
import { hashPassword } from '../src/services/auth.service';
import { Role } from '../src/utils/constants';

export async function startTestDb(name: string) {
  await connectDb(`${process.env.MONGODB_URI}${name}`);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function stopTestDb() {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}

export async function clearCollections(except: string[] = []) {
  for (const [name, model] of Object.entries(mongoose.models)) {
    if (name === 'AuditLog' || except.includes(name)) continue;
    await model.deleteMany({});
  }
  // AuditLog blocks deleteMany by design; drop the collection for a clean slate.
  await mongoose.connection.collection('auditlogs').deleteMany({});
}

export const PASSWORD = 'Passw0rd!x';

export async function createUser(role: Role, email = `${role.toLowerCase()}@test.dev`, extra: object = {}) {
  return User.create({
    name: `${role} User`,
    email,
    role,
    passwordHash: await hashPassword(PASSWORD),
    ...extra,
  });
}

export async function loginAs(app: Express, email: string, password = PASSWORD): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Creates one user of each role and returns their tokens. */
export async function seedRoles(app: Express) {
  const admin = await createUser('ADMIN');
  const faculty = await createUser('FACULTY');
  const student = await createUser('STUDENT');
  return {
    admin, faculty, student,
    adminToken: await loginAs(app, admin.email),
    facultyToken: await loginAs(app, faculty.email),
    studentToken: await loginAs(app, student.email),
  };
}
