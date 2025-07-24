/**
 * @fileoverview A chatbot for a green products store.
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, svg } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { GoogleGenAI, type Chat } from '@google/genai';

interface Message {
  text: string;
  sender: 'user' | 'bot';
  isTyping?: boolean;
}

@customElement('chat-bot')
export class ChatBot extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background-color: var(--surface-color, #fff);
      font-family: var(--font-family, sans-serif);
    }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .chat-header {
      background: linear-gradient(135deg, var(--primary-color, #2E7D32), var(--secondary-color, #4CAF50));
      color: white;
      padding: 1rem 1.5rem;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 10;
    }
    .chat-header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .message-list {
      flex-grow: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .message {
      padding: 0.75rem 1rem;
      border-radius: var(--border-radius, 12px);
      max-width: 75%;
      line-height: 1.5;
      word-wrap: break-word;
      animation: popIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    }
    .message.user {
      background-color: var(--user-message-bg, #DCF8C6);
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .message.bot {
      background-color: var(--bot-message-bg, #FFFFFF);
      align-self: flex-start;
      border: 1px solid #eee;
      border-bottom-left-radius: 4px;
    }
    .message-form {
      display: flex;
      padding: 1rem;
      border-top: 1px solid #e0e0e0;
      background-color: #fafafa;
      gap: 0.75rem;
    }
    #chat-input {
      flex-grow: 1;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: var(--border-radius, 12px);
      font-family: inherit;
      font-size: 1rem;
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    #chat-input:focus {
      outline: none;
      border-color: var(--primary-color, #2E7D32);
      box-shadow: 0 0 0 2px rgba(46, 125, 50, 0.2);
    }
    #chat-input:disabled {
      background-color: #f5f5f5;
    }
    .send-button {
      background-color: var(--primary-color, #2E7D32);
      border: none;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background-color 0.3s, transform 0.2s;
    }
    .send-button:hover:not(:disabled) {
      background-color: var(--secondary-color, #4CAF50);
    }
    .send-button:active:not(:disabled) {
      transform: scale(0.95);
    }
    .send-button:disabled {
      background-color: #BDBDBD;
      cursor: not-allowed;
    }
    .send-button svg {
      fill: white;
      width: 24px;
      height: 24px;
    }
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .typing-indicator span {
      width: 8px;
      height: 8px;
      background-color: #9E9E9E;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }
    .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
    .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1.0); }
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
  `;

  @state() private messages: Message[] = [];
  @state() private isLoading = false;

  @query('#chat-input') private chatInput!: HTMLInputElement;
  @query('.message-list') private messageList!: HTMLDivElement;

  private ai: GoogleGenAI;
  private chat: Chat | null = null;
  
  constructor() {
    super();
    if (!process.env.API_KEY) {
      console.error("API_KEY environment variable not set.");
      return;
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  override firstUpdated() {
    this.startChat();
  }

  override updated() {
    this.scrollToBottom();
  }

  private scrollToBottom() {
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  private startChat() {
    this.chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `Bạn là một trợ lý cửa hàng thân thiện và hữu ích cho một cửa hàng bán các sản phẩm thân thiện với môi trường, bền vững và 'xanh'. 
        Mục tiêu của bạn là trả lời các câu hỏi của khách hàng, cung cấp thông tin về sản phẩm và giúp họ đưa ra những lựa chọn bền vững. 
        Hãy luôn tích cực, tỏ ra hiểu biết và khuyến khích khách hàng.`,
      },
    });
    this.messages = [
      {
        text: 'Xin chào! Tôi là trợ lý ảo của cửa hàng. Tôi có thể giúp gì cho bạn về các sản phẩm xanh của chúng tôi hôm nay?',
        sender: 'bot',
      },
    ];
  }

  private async handleSendMessage(e: Event) {
    e.preventDefault();
    const userInput = this.chatInput.value.trim();
    if (!userInput || this.isLoading || !this.chat) return;

    this.messages = [...this.messages, { text: userInput, sender: 'user' }];
    this.chatInput.value = '';
    this.isLoading = true;
    
    // Add typing indicator
    this.messages = [...this.messages, { text: '', sender: 'bot', isTyping: true }];

    try {
      const stream = await this.chat.sendMessageStream({ message: userInput });

      let botResponse = '';
      // Remove typing indicator before streaming
      this.messages = this.messages.slice(0, -1);
      // Add new empty message for streaming
      this.messages = [...this.messages, { text: '', sender: 'bot' }];

      for await (const chunk of stream) {
        botResponse += chunk.text;
        // Update the last message (the bot's response) immutably
        this.messages = [
          ...this.messages.slice(0, -1),
          { ...this.messages[this.messages.length - 1], text: botResponse },
        ];
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.';
      // Remove typing indicator and replace with error message
      this.messages = [
        ...this.messages.slice(0, -1),
        { text: errorMessage, sender: 'bot' },
      ];
    } finally {
      this.isLoading = false;
    }
  }
  
  private renderSendIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    `;
  }

  override render() {
    return html`
      <header class="chat-header">
        <h1>Trợ lý Sản phẩm Xanh 🌿</h1>
      </header>
      <main>
        <div class="message-list" aria-live="polite">
          ${this.messages.map((msg) => html`
            <div class=${classMap({ message: true, [msg.sender]: true })}>
              ${msg.isTyping
                ? html`
                    <div class="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>`
                : msg.text}
            </div>
          `)}
        </div>
        <form class="message-form" @submit=${this.handleSendMessage}>
          <input
            id="chat-input"
            type="text"
            placeholder="Nhập câu hỏi của bạn..."
            autocomplete="off"
            aria-label="Chat Input"
            .disabled=${this.isLoading}
          />
          <button
            class="send-button"
            type="submit"
            aria-label="Send Message"
            .disabled=${this.isLoading}>
            ${this.renderSendIcon()}
          </button>
        </form>
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-bot': ChatBot;
  }
}
