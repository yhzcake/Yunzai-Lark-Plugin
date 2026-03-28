logger.info(logger.yellow("- 正在加载 Echo 插件"))

import plugin from "../../lib/plugins/plugin.js"
import makeConfig from "../../lib/plugins/config.js"

const { config, configSave } = await makeConfig("Echo", {
  permission: "master",
}, {
  tips: [
    "欢迎使用 Echo 插件!",
    "#echo <文本> - 回显文本",
    "#retry - 重试回复的指令",
  ],
})

export class EchoPlugin extends plugin {
  constructor() {
    super({
      name: "EchoPlugin",
      dsc: "Echo 插件 - 回显和重试功能",
      event: "message",
      rule: [
        {
          reg: "^echo\\s*(.*)$",
          fnc: "echo",
          permission: "everyone",
        },
        {
          reg: "^(retry|重复触发)$",
          fnc: "retry",
          permission: "everyone",
        }
      ]
    })
  }

  /**
   * Echo 功能：将用户输入的文本原样返回
   * 使用方式：echo 你好世界
   * 回复：你好世界
   * 或者回复某条消息发送 echo，重复该消息
   */
  async echo() {
    // this.e.msg 已经是去掉指令头的消息内容
    let text = this.e.msg.trim()
    
    // 如果没有提供文本，检查是否有回复消息
    // 注意：this.e.reply 是方法，不是对象！应该检查 this.e.reply_id
    if (!text && this.e.reply_id) {
      Bot.makeLog("debug", `检测到回复消息，reply_id: ${this.e.reply_id}`, this.e.self_id)
      
      // 尝试获取回复消息
      const replyMsg = await this.e.getReply?.()
      if (replyMsg) {
        Bot.makeLog("debug", `回复消息内容：${JSON.stringify(replyMsg)}`, this.e.self_id)
        
        // 从回复消息中提取文本
        if (replyMsg.message) {
          if (Array.isArray(replyMsg.message)) {
            text = replyMsg.message
              .filter(m => m.type === "text")
              .map(m => m.text)
              .join(" ")
              .trim()
          }
        }
        
        // 尝试从 raw_message 获取
        if (!text && replyMsg.raw_message) {
          text = replyMsg.raw_message.trim()
        }
      } else {
        Bot.makeLog("warn", `无法获取回复消息内容`, this.e.self_id)
      }
    }
    
    if (!text) {
      await this.reply("请提供要回显的文本内容，或回复一条消息后使用 echo", true)
      return
    }
    
    Bot.makeLog("info", `Echo: ${text}`, this.e.self_id)
    await this.reply(text, true)
  }

  /**
   * Retry 功能：重新触发回复消息中的指令
   * 使用方式：回复某条消息，然后发送 #retry 或 #重复触发
   * 效果：将回复的那条消息当作新指令重新处理
   */
  async retry() {
    // 检查是否有回复消息
    if (!this.e.reply_id) {
      await this.reply("请回复一条包含指令的消息后再使用 #retry", true)
      return
    }

    // 获取回复消息
    const replyMsg = await this.e.getReply?.()
    if (!replyMsg) {
      await this.reply("无法获取回复消息内容", true)
      return
    }
    
    Bot.makeLog("debug", `回复消息内容：${JSON.stringify(replyMsg)}`, this.e.self_id)

    // 获取回复消息的原始内容
    let originalMsg = ""
    
    // 尝试从不同位置获取消息内容
    if (replyMsg.message) {
      // 如果是数组，拼接所有文本内容
      if (Array.isArray(replyMsg.message)) {
        originalMsg = replyMsg.message
          .filter(m => m.type === "text")
          .map(m => m.text)
          .join(" ")
          .trim()
      } else if (typeof replyMsg.message === "string") {
        originalMsg = replyMsg.message.trim()
      }
    }

    // 尝试从 raw_message 获取
    if (!originalMsg && replyMsg.raw_message) {
      originalMsg = replyMsg.raw_message.trim()
    }

    if (!originalMsg) {
      await this.reply("未找到可重试的消息内容", true)
      return
    }

    Bot.makeLog("info", `Retry 原始消息：${originalMsg}`, this.e.self_id)

    // 检查原始消息是否以指令前缀开头（支持多种前缀）
    const cmdPrefixes = ["#", "/", "!", "."]
    if (!cmdPrefixes.some(prefix => originalMsg.startsWith(prefix))) {
      await this.reply("回复的消息不是指令，无法重试", true)
      return
    }

    await this.reply(`重新执行指令：${originalMsg}`, true)

    // 构造新的事件数据，模拟用户发送原始指令
    const newEvent = {
      ...this.e,
      msg: originalMsg,
      raw_message: originalMsg,
    }

    // 触发新的事件，让 Yunzai 重新处理指令
    Bot.makeLog("info", `触发重试指令：${originalMsg}`, this.e.self_id)
    
    // 触发 message 事件（Yunzai 会自动向上触发）
    Bot.em(`message.${this.e.message_type}`, newEvent)
  }
}

logger.info(logger.green("- Echo 插件 加载完成"))
