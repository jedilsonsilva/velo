import { destroyDb } from './database'

export default async function globalTeardown() {
  await destroyDb()
}
