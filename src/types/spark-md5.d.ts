declare module 'spark-md5' {
  export class SparkMD5ArrayBuffer {
    append(data: ArrayBuffer): void
    end(): string
    reset(): void
  }

  export default class SparkMD5 {
    static ArrayBuffer: typeof SparkMD5ArrayBuffer
  }
}
