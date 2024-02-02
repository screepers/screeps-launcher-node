import { parentPort } from 'worker_threads'
import type { Config, ModConstructor } from './mod.types'

enum TestConditionType {
  RoomObject = 'roomObject',
  EnvValue = 'envValue',
} 

interface TestConditionBase {
  type: TestConditionType
}

interface TestConditionRoomObject extends TestConditionBase {
  type: TestConditionType.RoomObject
  roomObject: Partial<RoomObject>
}

interface TestConditionEnvValue extends TestConditionBase {
  type: TestConditionType.EnvValue
  key: string
  value: string
}

type TestConditionFn = (config: Config) => Promise<boolean>

type TestCondition =  TestConditionRoomObject | TestConditionEnvValue | TestConditionFn

interface Test {
  condition: TestCondition
  action: (config: Config) => Promise<void>
  triggered?: boolean
  repeat?: boolean
}

const mod: ModConstructor = config => {
  let tests: Test[] = []



  tests.push({
    condition: {
      type: TestConditionType.EnvValue,
      key: 'gameTime',
      value: '100',
    },
    async action(config) {
      console.log('Tick 100 hit, terminating!')
      config.screepsLauncher.terminate()
    }
  })

  tests.push({
    async condition(config) {
      return true // Forcing trigger, for abuse purpose
    },
    async action(config) {
      // config.utils.
    }
  })

  const doTest = async (test: Test) => {
    if (test.triggered && !test.repeat) return
    const { condition, action } = test
    const map = () => {
      if (typeof condition === 'function') return condition(config)
      if (condition.type === TestConditionType.EnvValue) {
        return testForEnvValue(condition.key, condition.value)
      }
      if (condition.type === TestConditionType.RoomObject) {
        return testForRoomObject(condition.roomObject)
      }
      return Promise.resolve(false)
    }
    const ret = await map()
    if (ret) {
      await action(config)
      test.triggered = true
    }
  } 

  const screepsLauncher = config.screepsLauncher = config.screepsLauncher || {}
  screepsLauncher.terminate = () => {
    parentPort?.postMessage('terminate')
  }

  if (config.backend) {
    config.backend.on('expressPreConfig', () => {

    })
  }
  if (config.engine) {
    config.engine.on('init', module => {
      if (module === 'main') {
        if (!config.engine) return // Just to satisfy TS
        const orig = config.engine.mainLoopCustomStage
        config.engine.mainLoopCustomStage = async () => {
          await Promise.all(tests.map(doTest))
        }
      }
    })
  }

  async function testForRoomObject(object: Partial<RoomObject>) {
    const rec = await config.common.storage.db['rooms.objects'].findOne<RoomObject>(object)
    return !!rec
  }

  async function testForEnvValue(key: string, value: string) {
    const val = await config.common.env.get(key)
    return val == value
  }
}

interface RoomObject {
  _id: string
  type: string
  room: string
  name: string
  x: number
  y: number
  [prop: string]: any
}

export default mod