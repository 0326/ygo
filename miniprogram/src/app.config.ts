export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/card/index',
    'pages/maker/index',
    'pages/login/index',
    'pages/me/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#05070e',
    navigationBarTitleText: '决斗者卡查',
    navigationBarTextStyle: 'white',
    backgroundColor: '#05070e',
  },
  tabBar: {
    color: '#617a9c',
    selectedColor: '#3fd8ee',
    backgroundColor: '#0a1220',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '查卡' },
      { pagePath: 'pages/maker/index', text: '自制' },
      { pagePath: 'pages/me/index', text: '我的' },
    ],
  },
})
