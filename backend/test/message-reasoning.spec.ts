import { Message } from '../src/modules/chat/message.entity';

describe('Message Reasoning Persistence', () => {
  it('instantiates Message with reasoning_content and thinkingDurationMs', () => {
    const msg = new Message();
    msg.id = 'm1';
    msg.role = 'assistant';
    msg.content = 'Final answer';
    msg.reasoning_content = 'Thinking step 1...';
    msg.thinkingDurationMs = 2450;

    expect(msg.reasoning_content).toBe('Thinking step 1...');
    expect(msg.thinkingDurationMs).toBe(2450);
  });

  it('defaults reasoning fields to null or undefined on uninitialized entity', () => {
    const msg = new Message();
    expect(msg.reasoning_content).toBeUndefined();
    expect(msg.thinkingDurationMs).toBeUndefined();
  });
});
