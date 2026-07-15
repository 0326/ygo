/// <reference types="@tarojs/taro" />

declare module '*.png'
declare module '*.gif'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.svg'
declare module '*.css'
declare module '*.scss'

// config/index.ts 注入的编译期常量
declare const YGO_API_BASE: string

declare namespace NodeJS {
  interface ProcessEnv {
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'tt' | 'h5' | 'qq' | 'jd'
    YGO_API_BASE?: string
    YGO_DEV_API?: string
  }
}
