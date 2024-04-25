class ChatMessageSender
{
  constructor()
  {
    this.inputField = null;
    this.sendButton = null;
    this.lastSentTime = null;
  }

  init(inputFieldId, sendButtonSelector)
  {
    this.inputField = document.getElementById(inputFieldId);
    this.sendButton = document.querySelector(sendButtonSelector);
    this.lastSentTime = Date.now();
  }

  // Return true every 15 seconds
  checkTimeout()
  {
    if (Date.now() - this.lastSentTime < 15000)
      return false;
    this.lastSentTime = Date.now();
    return true;
  }

  sendMessage(message)
  {
    if (!this.inputField || !this.sendButton)
      throw new Error('ChatMessageSender not initialized');
    if (!this.checkTimeout())
      return;
    this.inputField.value = "[auto] " + message;
    this.sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
}
