import EventEmitter from "node:events"
import { Socket } from "node:net"

export interface CronJobs {
  [name: string]: [time: number, () => void, number]
}

export interface Backend extends EventEmitter {
  on(event: 'expressPreConfig', listener: (app: any) => void): this
}

export interface Engine extends EventEmitter {
  on(event: 'init', listener: (module: string) => void): this
  mainLoopCustomStage(): Promise<void>
}

export type DBQuery = any
export interface DBUpdateOpts {
  multi: boolean
}

export interface DBFindExOpts {
  offset: number
  skip: number
}

export interface Database {
  [collectionName: string]: Collection
}
export interface Collection {
  find<T>(query: DBQuery, projection?: any): Promise<T>
  findOne<T>(query: DBQuery): Promise<T | null | undefined>
  findEx<T>(query: DBQuery, opts?: DBFindExOpts): Promise<T>
  insert<T>(doc: Partial<T> | Partial<T>[]): Promise<T>
  count(query: DBQuery): Promise<number>
  update<T>(doc: T | { $set: Partial<T> }, opts?: DBUpdateOpts): Promise<any>
  update<T>(query: DBQuery, doc: T | { $set: Partial<T> }, opts?: DBUpdateOpts): Promise<any>
  drop(): Promise<void>
  clear(): Promise<void>
  by<T>(_id: string): Promise<T[]>
  bulk(bulk: any, cb: (err?: string) => void): Promise<void>
}

export interface Storage {
  db: Database
  env: any
  pubsub: any
}

export interface Env {
  get(key: string): Promise<string>
  set(key: string, value: string): Promise<void>
} 

export interface Common {
  storage: Storage
  env: Env
}

export interface CliSandbox {
  print(...args: any): void
  storage: Storage
  map: any
  bots: any
  strongholds: any
  system: any
}

export interface Cli extends EventEmitter {
  greeting: string
  connectionListener(socket: Socket): void
  createSandbox(outputCallback: (data: string) => void): CliSandbox
  on(event: 'sandbox', listener: (sanbox: CliSandbox) => void): this
}

export interface Config {
  common: Common
  cronjobs?: CronJobs
  cli?: Cli
  backend?: Backend
  engine?: Engine
  screepsLauncher: {
    terminate(): void
  }
  [name: string]: any
}

export type ModConstructor = (config: Config) => void