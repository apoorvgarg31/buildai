/**
 * Test: Chat UI components render correctly
 * 
 * Uses jsdom + @testing-library/react to test component rendering.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ChatMessage from '../src/components/ChatMessage';

afterEach(() => {
  cleanup();
});

describe('ChatMessage Component', () => {

  it('should render assistant message', () => {
    const message = {
      id: 'test-1',
      role: 'assistant' as const,
      content: 'Hello from BuildAI!',
      timestamp: new Date('2026-02-17T12:00:00Z'),
    };

    render(<ChatMessage message={message} />);
    expect(screen.getByText('Hello from BuildAI!')).toBeDefined();
  });

  it('should render user message', () => {
    const message = {
      id: 'test-2',
      role: 'user' as const,
      content: 'Show me open RFIs',
      timestamp: new Date('2026-02-17T12:00:00Z'),
    };

    render(<ChatMessage message={message} />);
    expect(screen.getByText('Show me open RFIs')).toBeDefined();
  });

  it('should show agent avatar (B) for assistant messages', () => {
    const message = {
      id: 'test-3',
      role: 'assistant' as const,
      content: 'Response text',
      timestamp: new Date('2026-02-17T12:00:00Z'),
    };

    render(<ChatMessage message={message} />);
    expect(screen.getByText('B')).toBeDefined();
  });

  it('should show user avatar (PM) for user messages', () => {
    const message = {
      id: 'test-4',
      role: 'user' as const,
      content: 'User text',
      timestamp: new Date('2026-02-17T12:00:00Z'),
    };

    render(<ChatMessage message={message} />);
    expect(screen.getByText('PM')).toBeDefined();
  });

  it('should display timestamp', () => {
    const message = {
      id: 'test-5',
      role: 'assistant' as const,
      content: 'Test message',
      timestamp: new Date('2026-02-17T12:30:00Z'),
    };

    const { container } = render(<ChatMessage message={message} />);
    // Timestamp should be rendered (format depends on locale)
    const timeElements = container.querySelectorAll('p');
    const hasTime = Array.from(timeElements).some(el => 
      el.textContent && /\d{1,2}:\d{2}/.test(el.textContent)
    );
    expect(hasTime).toBe(true);
  });

  it('should style assistant messages differently from user messages', () => {
    const assistantMsg = {
      id: 'test-6a',
      role: 'assistant' as const,
      content: 'Assistant says hi',
      timestamp: new Date(),
    };
    
    const { container: assistantContainer } = render(<ChatMessage message={assistantMsg} />);
    const assistantWrapper = assistantContainer.firstElementChild as HTMLElement;
    expect(assistantWrapper.className).toContain('justify-start');
    
    cleanup();
    
    const userMsg = {
      id: 'test-6b',
      role: 'user' as const,
      content: 'User says hi',
      timestamp: new Date(),
    };
    
    const { container: userContainer } = render(<ChatMessage message={userMsg} />);
    const userWrapper = userContainer.firstElementChild as HTMLElement;
    expect(userWrapper.className).toContain('justify-end');
  });
});
