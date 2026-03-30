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
          // Yunzai 会自动将 / 转换为 #，所以只需要匹配 #
          reg: "^#echo\\s*(.*)$",
          fnc: "echo",
          permission: "everyone",
        },
        {
          reg: "^#(retry|重复触发)$",
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
    // 提取消息内容（保留结构化信息）
    let messageContent = []
    let textContent = ""
    
    // 如果有回复消息，使用回复消息的完整内容
    if (this.e.reply_id) {
      Bot.makeLog("debug", `检测到回复消息，reply_id: ${this.e.reply_id}`, this.e.self_id)
      
      // 尝试获取回复消息
      const replyMsg = await this.e.getReply?.()
      if (replyMsg) {
        Bot.makeLog("debug", `回复消息内容：${JSON.stringify(replyMsg)}`, this.e.self_id)
        
        // 优先使用完整的 message 数组（保留@、图片等结构化信息）
        if (replyMsg.message && Array.isArray(replyMsg.message)) {
          // 过滤掉 reply 元素，避免重复触发回复逻辑
          messageContent = replyMsg.message.filter(m => m.type !== "reply")
          textContent = replyMsg.raw_message || replyMsg.message
            .filter(m => m.type === "text")
            .map(m => m.text)
            .join(" ")
            .trim()
          
          // 去掉指令头（#echo、/echo 等），只保留参数部分
          const cmdMatch = textContent.match(/^[#/!.]?echo\s*(.*)$/i)
          if (cmdMatch) {
            textContent = cmdMatch[1] || ""
            // 如果去掉了指令头，也需要更新 messageContent
            const textElements = messageContent.filter(m => m.type === "text")
            if (textElements.length > 0) {
              // 更新第一个 text 元素，去掉指令头
              const firstText = textElements[0].text
              const newText = firstText.replace(/^[#/!.]?echo\s*/i, "")
              if (newText.trim() === "") {
                // 如果去掉指令头后为空，移除这个元素
                messageContent = messageContent.filter(m => m !== textElements[0])
              } else {
                textElements[0].text = newText
              }
            }
          }
          Bot.makeLog("debug", `从 message 数组获取：${JSON.stringify(messageContent)}`, this.e.self_id)
        } else if (replyMsg.raw_message) {
          // 降级处理：只有纯文本
          textContent = replyMsg.raw_message.trim()
          messageContent = [{ type: "text", text: textContent }]
          Bot.makeLog("debug", `从 raw_message 获取：${replyMsg.raw_message}`, this.e.self_id)
        }
      } else {
        Bot.makeLog("warn", `无法获取回复消息内容`, this.e.self_id)
      }
    } else {
      // 没有回复消息，使用当前消息（去掉指令头）
      const match = this.e.msg.match(/^#echo\s*(.*)$/)
      textContent = match ? match[1].trim() : ""
      if (textContent) {
        messageContent = [{ type: "text", text: textContent }]
      } else {
        messageContent = this.e.message || []
      }
    }
    
    Bot.makeLog("debug", `Echo 原始消息：${this.e.msg}`, this.e.self_id)
    Bot.makeLog("debug", `Echo 提取的文本：${textContent}`, this.e.self_id)
    Bot.makeLog("debug", `Echo message 数组：${JSON.stringify(messageContent)}`, this.e.self_id)
    
    if (!textContent && messageContent.length === 0) {
      await this.reply("请提供要回显的文本内容，或回复一条消息后使用 echo", true)
      return
    }
    
    Bot.makeLog("info", `Echo: ${textContent}`, this.e.self_id)
    // 直接发送原始 message 数组，保留@、图片等所有信息
    await this.reply(messageContent, true)
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
    Bot.makeLog("debug", `回复消息 raw_message: ${replyMsg.raw_message}`, this.e.self_id)
    Bot.makeLog("debug", `回复消息 message: ${JSON.stringify(replyMsg.message)}`, this.e.self_id)

    // 获取回复消息的原始内容
    let messageContent = []
    
    // 优先使用完整的 message 数组（保留@、图片等结构化信息）
    if (replyMsg.message && Array.isArray(replyMsg.message)) {
      // 过滤掉 reply 元素，避免重复触发回复逻辑
      messageContent = replyMsg.message.filter(m => m.type !== "reply")
      Bot.makeLog("debug", `从 message 数组获取：${JSON.stringify(messageContent)}`, this.e.self_id)
    } else if (replyMsg.raw_message) {
      // 降级处理：只有纯文本
      messageContent = [{ type: "text", text: replyMsg.raw_message.trim() }]
      Bot.makeLog("debug", `从 raw_message 获取：${replyMsg.raw_message}`, this.e.self_id)
    }

    if (messageContent.length === 0) {
      await this.reply("未找到可重试的消息内容", true)
      return
    }

    // 从 messageContent 中提取纯文本用于日志和指令检查
    const textContent = messageContent
      .filter(m => m.type === "text")
      .map(m => m.text)
      .join(" ")
      .trim()

    if (!textContent) {
      await this.reply("回复的消息不是文本指令，无法重试", true)
      return
    }

    // 检查原始消息是否以指令前缀开头（支持多种前缀）
    const cmdPrefixes = ["#", "/", "!", "."]
    if (!cmdPrefixes.some(prefix => textContent.startsWith(prefix))) {
      await this.reply("回复的消息不是指令，无法重试", true)
      return
    }

    Bot.makeLog("info", `Retry 原始消息：${textContent}`, this.e.self_id)

    // 构造新的事件数据，模拟用户发送原始指令
    const newEvent = {
      ...this.e,
      // 清除当前消息的 msg 和 raw_message，避免包含 #retry 指令本身
      msg: undefined,
      raw_message: undefined,
      // 使用完整的 message 数组，保留@、图片等所有信息
      message: messageContent,
    }

    // 触发新的事件，让 Yunzai 重新处理指令
    Bot.makeLog("info", `触发重试指令：${textContent}`, this.e.self_id)
    
    // 触发 message 事件（Yunzai 会自动向上触发）
    Bot.em(`message.${this.e.message_type}`, newEvent)
  }
}

logger.info(logger.green("- Echo 插件 加载完成"))
