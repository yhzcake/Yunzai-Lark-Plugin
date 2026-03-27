# 飞书机器人适配器使用指南

本指南将详细介绍如何从零开始创建飞书机器人，并将其连接到 TRSS-Yunzai 框架。

## 目录

1. [飞书开放平台申请机器人](#1-飞书开放平台申请机器人)
2. [获取机器人凭证信息](#2-获取机器人凭证信息)
3. [安装依赖](#3-安装依赖)
4. [配置 lark.js](#4-配置-larkjs)
5. [连接到 TRSS-Yunzai](#5-连接到-trss-yunzai)
6. [使用说明](#6-使用说明)
7. [常见问题](#7-常见问题)

---

## 1. 飞书开放平台申请机器人

### 1.1 访问飞书开放平台

打开浏览器，访问 [飞书开放平台](https://open.feishu.cn/)

### 1.2 创建企业自建应用

1. 登录飞书开放平台（需要飞书账号）
2. 点击右上角「创建应用」
3. 选择「企业自建应用」
4. 填写应用信息：
   - **应用名称**：例如 "TRSS-Yunzai Bot"
   - **应用描述**：例如 "TRSS-Yunzai 框架的飞书机器人适配器"
   - **应用图标**：上传一个合适的图标
5. 点击「创建」

### 1.3 配置应用权限

创建成功后，进入应用详情页面，需要配置以下权限：

#### 必需权限

1. **消息权限**
   - `im:message` - 发送和接收消息
   - `im:message:group_at_msg` - 接收群组@消息
   - `im:message:group_at_msg:readonly` - 读取群组@消息
   - `im:resource` - 读写文件（用于图片）

2. **联系人权限**
   - `contact:user.base:readonly` - 读取用户基本信息
   - `contact:user.email:readonly` - 读取用户邮箱（可选）
   - `contact:user.employee_id:readonly` -获取user id（可选）

3. **群组权限**
   - `im:chat` - 读取群组信息
   - `im:chat:readonly` - 只读群组信息

#### 添加权限步骤

1. 在应用详情页左侧菜单选择「权限管理」
2. 搜索并勾选上述必需权限
3. 点击「申请权限」
4. 按照提示完成权限申请流程

### 1.4 配置事件订阅

1. 在应用详情页左侧菜单选择「事件订阅」
2. 开启「启用事件订阅」
3. 配置请求地址（稍后配置，先跳过）
4. 订阅以下事件：
   - `im.message.receive_v1` - 接收消息事件

---

## 2. 获取机器人凭证信息

### 2.1 获取 App ID 和 App Secret

1. 在应用详情页左侧菜单选择「凭证与基础信息」
2. 复制以下信息：
   - **App ID**：格式如 `cli_xxxxxxxxxxxxxxxx`
   - **App Secret**：格式如 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2.2 获取 Encrypt Key 和 Verification Token（可选）

如果需要启用事件加密验证：

1. 在应用详情页左侧菜单选择「事件订阅」
2. 点击「添加 Encrypt Key」
3. 系统会自动生成一个 Encrypt Key，复制保存
4. 在同一页面找到 Verification Token，复制保存

### 2.3 添加 Webhook 地址

1. 在应用详情页左侧菜单选择「事件与回调」
2. 订阅方式修改为“将事件发送至开发者服务器”
3. 请求地址填“http://[你的域名]:[你的yunzai默认端口]/lark/webhook”

回调配置同理，用于卡片按钮点击

---

## 3. 安装依赖

### 3.1 安装飞书 SDK

在 TRSS-Yunzai 项目根目录下运行：

```bash
npm install @larksuiteoapi/node-sdk
```

### 3.2 验证安装

```bash
npm list @larksuiteoapi/node-sdk
```

如果显示版本号，说明安装成功。

---

## 4. 配置 lark.js

### 4.1 放置 lark.js 文件

将 `lark.js` 文件放置到 TRSS-Yunzai 的插件目录中：

```
TRSS-Yunzai/
├── plugins/
│   └── example/
│       └── lark.js
```

### 4.2 通过命令行配置

启动 TRSS-Yunzai 后，使用以下命令配置：

#### 设置 App ID

```
#lark设置 appid cli_xxxxxxxxxxxxxxxx
```

#### 设置 App Secret

```
#lark设置 secret xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 设置 Encrypt Key（可选）

```
#lark设置 encrypt xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 设置 Verification Token（可选）

```
#lark设置 verify xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 设置代理（可选）

```
#lark代理 http://proxy.example.com:8080
```

### 4.3 查看当前配置

```
#lark账号
```

### 4.4 配置文件方式（可选）

也可以直接编辑配置文件，通常位于：

```
TRSS-Yunzai/data/config/Lark.yaml
```

配置内容：

```yaml
tips: ""
permission: "master"
app_id: "cli_xxxxxxxxxxxxxxxx"
app_secret: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
encrypt_key: ""
verification_token: ""
webhook_path: "/lark/webhook"
proxy: ""
```

---

## 5. 连接到 TRSS-Yunzai

### 5.1 重启 TRSS-Yunzai

配置完成后，需要重启 TRSS-Yunzai 使配置生效：

```bash
# 停止当前运行的 Yunzai
# 然后重新启动
node app.js
```

### 5.2 验证连接

启动后，查看控制台日志，应该看到：

```
- 正在加载飞书适配器插件
飞书机器人连接成功
LarkBot(Lark) v1.0.0 已连接
- 飞书适配器插件 加载完成
```

如果看到连接失败的错误，请检查：
- App ID 和 App Secret 是否正确
- 网络连接是否正常
- 代理设置是否正确（如果需要）

### 5.3 测试机器人

1. 在飞书中找到你的机器人应用
2. 将机器人添加到群组或发起私聊
3. 发送测试消息，机器人应该能够接收

---

## 6. 使用说明

### 6.1 基本消息发送

在 TRSS-Yunzai 的其他插件中，可以使用以下方式发送消息：

#### 发送文本消息

```javascript
const bot = Bot['lark_cli_xxxxxxxxxxxxxxxx']
const group = bot.pickGroup('lark_oc_xxxxxxxxxxxxxxxx')

group.sendMsg('Hello, 飞书！')
```

#### 发送图片消息

```javascript
group.sendMsg({
  type: 'image',
  file: 'path/to/image.jpg'
})
```

#### 发送@提及消息

```javascript
group.sendMsg([
  { type: 'text', text: 'Hello ' },
  { type: 'at', qq: 'lark_ou_xxxxxxxxxxxxxxxx' },
  { type: 'text', text: '！' }
])
```

#### 发送@所有人

```javascript
group.sendMsg([
  { type: 'at', qq: 'all' },
  { type: 'text', text: ' 大家好！' }
])
```

### 6.2 消息接收

飞书适配器会自动将接收到的消息转换为 TRSS-Yunzai 的标准格式，并触发相应事件：

#### 监听群组消息

```javascript
export class MyPlugin extends plugin {
  constructor() {
    super({
      name: 'MyPlugin',
      dsc: '我的插件',
      event: 'message.group',
      priority: 5000,
      rule: [
        {
          reg: '^你好',
          fnc: 'hello'
        }
      ]
    })
  }

  hello() {
    this.reply('你好！我是飞书机器人')
  }
}
```

#### 监听私聊消息

```javascript
export class PrivatePlugin extends plugin {
  constructor() {
    super({
      name: 'PrivatePlugin',
      dsc: '私聊插件',
      event: 'message.private',
      priority: 5000,
      rule: [
        {
          reg: '^帮助',
          fnc: 'help
        }
      ]
    })
  }

  help() {
    this.reply('这是帮助信息')
  }
}
```

### 6.3 获取用户和群组信息

#### 获取用户信息

```javascript
const bot = Bot['lark_cli_xxxxxxxxxxxxxxxx']
const friend = bot.pickFriend('lark_ou_xxxxxxxxxxxxxxxx')
const userInfo = await friend.getInfo()

console.log(userInfo.nickname)
console.log(userInfo.avatar)
```

#### 获取群组列表

```javascript
const bot = Bot['lark_cli_xxxxxxxxxxxxxxxx']
const groupList = bot.getGroupList()

console.log(groupList)
```

#### 获取好友列表

```javascript
const bot = Bot['lark_cli_xxxxxxxxxxxxxxxx']
const friendList = bot.getFriendList()

console.log(friendList)
```

### 6.4 消息撤回

```javascript
const group = bot.pickGroup('lark_oc_xxxxxxxxxxxxxxxx')
const msg = await group.sendMsg('这是一条临时消息')

await Bot.sleep(3000)
group.recallMsg(msg.message_id)
```

---

## 7. 常见问题

### 7.1 连接失败

**问题**：启动后显示"飞书机器人连接失败"

**解决方案**：
1. 检查 App ID 和 App Secret 是否正确
2. 检查网络连接是否正常
3. 如果使用代理，检查代理设置是否正确
4. 查看控制台错误日志，获取详细错误信息

### 7.2 无法接收消息

**问题**：机器人无法接收飞书消息

**解决方案**：
1. 检查事件订阅是否正确配置
2. 检查权限是否已正确申请
3. 确认机器人已添加到群组或已发起私聊
4. 检查 Webhook 地址是否可访问（如果使用 Webhook）

### 7.3 无法发送消息

**问题**：机器人无法发送消息

**解决方案**：
1. 检查机器人是否有发送消息的权限
2. 检查群组 ID 或用户 ID 是否正确
3. 查看控制台错误日志，获取详细错误信息

### 7.4 文件上传失败

**问题**：发送图片、视频等文件失败

**解决方案**：
1. 检查文件路径是否正确
2. 检查文件大小是否超过限制
3. 检查网络连接是否正常
4. 查看控制台错误日志，获取详细错误信息

### 7.5 @提及不生效

**问题**：发送的@提及消息没有效果

**解决方案**：
1. 确保用户 ID 格式正确（需要 `lark_` 前缀）
2. 检查机器人是否有@提及的权限
3. 确认用户在群组中

### 7.6 代理设置不生效

**问题**：设置了代理但仍然无法连接

**解决方案**：
1. 确认代理地址格式正确
2. 测试代理是否可访问
3. 重启 TRSS-Yunzai 使配置生效
4. 检查代理服务器是否需要认证

### 7.7 权限不足

**问题**：操作时提示权限不足

**解决方案**：
1. 在飞书开放平台检查权限配置
2. 重新申请缺失的权限
3. 确认权限申请已通过审核
4. 重启 TRSS-Yunzai 使权限生效

---

## 8. 高级配置

### 8.1 多机器人支持

如果需要连接多个飞书机器人，可以修改 `lark.js` 的配置结构：

```javascript
const { config, configSave } = await makeConfig("Lark", {
  bots: [
    {
      app_id: "cli_xxxxxxxxxxxxxxxx",
      app_secret: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    },
    {
      app_id: "cli_yyyyyyyyyyyyyyyy",
      app_secret: "yyyyyyyyyyyyyyyyyyyyyyyyyyyy"
    }
  ]
})
```

### 8.2 自定义消息处理

可以在 `makeMessage` 方法中添加自定义的消息处理逻辑：

```javascript
makeMessage(data) {
  data.post_type = "message"
  data = this.makeMessageArray(data)
  
  if (data.user_id === data.self_id) return

  if (data.chat_type === "group") {
    data.message_type = "group"
    data:group_id = `lark_${data.chat_id}`
    data.group_name = data.chat_name || data.group_id
    
    Bot.makeLog("info", `群消息：[${data.group_name}(${data.group_id}), ${data.sender.nickname}(${data.user_id})] ${data.raw_message}`, data.self_id)
  } else {
    data.message_type = "private"
    Bot.makeLog("info", `私聊消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`, data.self_id)
  }

  Bot.em(`${data.post_type}.${data.message_type}`, data)
  
  Bot.em(`lark.message`, data)
}
```

### 8.3 Webhook 服务器配置

如果需要使用 Webhook 接收消息，需要配置一个 HTTP 服务器：

```javascript
import express from 'express'
import bodyParser from 'body-parser'

const app = express()
app.use(bodyParser.json())

app.post('/lark/webhook', async (req, res) => {
  const { challenge } = req.body
  
  if (challenge) {
    res.json({ challenge })
    return
  }
  
  const adapter = Bot.adapter.find(a => a.id === 'Lark')
  if (adapter) {
    adapter.makeMessage(req.body)
  }
  
  res.json({ code: 0, msg: 'success' })
})

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000')
})
```

---

## 9. 参考资源

- [飞书开放平台文档](https://open.feishu.cn/document)
- [飞书 Node.js SDK](https://www.npmjs.com/package/@larksuiteoapi/node-sdk)
- [TRSS-Yunzai 框架](https://github.com/TRSS-Yunzai)
- [飞书机器人开发指南](https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN)

---

## 10. 更新日志

### v1.0.0 (2024-03-26)

- 初始版本发布
- 支持基本的消息发送和接收
- 支持文本、图片、视频、文件等消息类型
- 支持@提及功能
- 支持用户和群组管理
- 支持代理配置
- 支持命令行管理

---

## 11. 联系与支持

如有问题或建议，请通过以下方式渠道：

- 提交 Issue 到项目仓库
- 加入 TRSS-Yunzai 社区讨论
- 查看飞书开放平台文档

---

**祝使用愉快！**
