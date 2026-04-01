"use client";

import { FormEvent, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearchParams, useRouter } from 'next/navigation';
import { TypingIndicator } from '@/components/typing-indicator';
import { Lock, Square, AudioLines, Send } from 'lucide-react';
import { useGoPro } from '@/hooks/use-go-pro';
import { useVoiceMode } from '@/app/services/chat-provider';

const DynamicMarkdown = dynamic(() => import('@/components/markdown-renderer'), { ssr: false });


interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  initialMessages: Message[];
  userName?: string;
  isPro: boolean;
  hasHadTrial: boolean;
}

export default function ChatInterface({
  initialMessages = [],
  userName = 'Adventurer',
  isPro = false,
  hasHadTrial = false
}: ChatInterfaceProps) {
  const {
    messages,
    setMessages,
    isLoading,
    isStreaming,
    sendMessage,
    stop,
    setIsOpen,
    input,
    setInput,
    voiceActivityTimestamp
  } = useVoiceMode();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { handleGoPro } = useGoPro();
  const hasSentInitialMessage = useRef(false);


  useEffect(() => {
    if (messages.length === 0 && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages, messages.length]);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading, isStreaming]);

  useEffect(() => {
    const queryMessage = searchParams.get('q');
    if (queryMessage && !hasSentInitialMessage.current) {
      hasSentInitialMessage.current = true;
      sendMessage(queryMessage);
      router.replace('/oracle');
    }
  }, [searchParams, router, sendMessage]);

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stop();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    stop();
    await sendMessage(input);
  };


  return (
    <div className="absolute -top-16 bottom-0 left-0 right-0 z-0 flex flex-col">


      <div
        ref={scrollContainerRef}
        className={`grow relative z-0 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-40 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
      >
        <div className="max-w-4xl mx-auto w-full space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground pt-10">
              <p>Ask the Oracle for guidance</p>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] md:max-w-2xl ${m.role === 'user'
                  ? 'chat-bubble-card-user text-foreground'
                  : 'chat-bubble-card rounded-tl-none'
                  }`}
              >
                <p className="font-semibold capitalize mb-1 opacity-70 uppercase tracking-wider text-xs">{m.role === 'user' ? userName : 'Oracle'}</p>
                <div className="text-[15px] leading-relaxed">
                  <DynamicMarkdown>{m.content}</DynamicMarkdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4">
        <div className="max-w-4xl mx-auto w-full">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the Oracle..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                }
              }}
              className="h-12 shadow-sm bg-card"
            />

            {/* Voice Mode Toggle */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-full text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
              onClick={() => setIsOpen(true)}
            >
              <AudioLines className="w-5 h-5" />
            </Button>

            {(isLoading || isStreaming) ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleStop}
                className="h-12 w-16 rounded-full border-red-500/50 text-red-500 hover:bg-red-500/10"
              >
                <Square className="h-4 w-4 text-red-500 fill-current" />
              </Button>
            ) : (
              <Button type="submit" className="h-12 w-16 rounded-full">
                <Send className="w-5 h-5" />
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}