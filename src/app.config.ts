export default defineAppConfig({
  pages: [
    'pages/inbox/index',
    'pages/issues/index',
    'pages/settings/index',
    'pages/login/index',
    'pages/issue-detail/index',
    'pages/create/index',
    'pages/workspace/index',
    'pages/inbox-archive/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'Multica',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f6f8',
  },
  tabBar: {
    color: '#98a2b3',
    selectedColor: '#4c84ff',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/inbox/index',
        text: '收件箱',
        iconPath: 'assets/tab/inbox.png',
        selectedIconPath: 'assets/tab/inbox-active.png',
      },
      {
        pagePath: 'pages/issues/index',
        text: '任务',
        iconPath: 'assets/tab/issues.png',
        selectedIconPath: 'assets/tab/issues-active.png',
      },
      {
        pagePath: 'pages/settings/index',
        text: '我的',
        iconPath: 'assets/tab/profile.png',
        selectedIconPath: 'assets/tab/profile-active.png',
      },
    ],
  },
})
