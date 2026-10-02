'use client';

import { LoaderCircle, MessageSquarePlus, Send } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, type ChatSession } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

const personas = ['Developer', 'QA', 'Product', 'Sales'] as const;
const personaToApi = {
  Developer: 'developer',
  QA: 'qa',
  Product: 'product',
  Sales: 'sales'
} as const;

interface AiChatPanelProps {
  projectId: string;
}

export const AiChatPanel = ({ projectId }: AiChatPanelProps) => {
  const [persona, setPersona] = useState<(typeof personas)[number]>('Developer');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [message, setMessage] = useState('Select a project to load chat history.');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setSessions([]);
      setActiveSessionId('');
      setMessage('Select a project to load chat history.');
      return;
    }

    let isMounted = true;
    setSessions([]);
    setActiveSessionId('');
    setMessage('Loading project chat history');
    setIsHistoryLoading(true);

    api
      .listChatSessions(projectId)
      .then((result) => {
        if (!isMounted) return;
        setSessions(result.data);
        setActiveSessionId(result.data[0]?.id ?? '');
        setMessage(result.data.length > 0 ? '' : 'No conversations yet for this project.');
      })
      .catch(() => {
        if (!isMounted) return;
        setMessage('Unable to load chat history for this project.');
      })
      .finally(() => {
        if (isMounted) setIsHistoryLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );

  const startConversation = async () => {
    if (!projectId) return;
    setIsHistoryLoading(true);

    try {
      const result = await api.createChatSession(projectId, { persona: personaToApi[persona] });
      setSessions((current) => [result.data, ...current]);
      setActiveSessionId(result.data.id);
      setMessage('');
    } catch {
      setMessage('Unable to start a new conversation.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (!projectId) {
      setMessage('Create a project and build context before asking.');
      return;
    }

    const formData = new FormData(form);
    const question = String(formData.get('question') || '').trim();

    if (!question) {
      return;
    }

    setIsLoading(true);
    setMessage('Finding evidence');

    try {
      const result = await api.addChatMessage(projectId, {
        sessionId: activeSession?.id,
        question,
        persona: personaToApi[persona]
      });
      setSessions((current) => [result.data, ...current.filter((session) => session.id !== result.data.id)]);
      setActiveSessionId(result.data.id);
      setMessage('');
      form.reset();
    } catch {
      setMessage('Unable to answer from indexed context.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="ai-chat" className="scroll-mt-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          <div className="text-sm font-medium">Project chat history</div>
          <div className="flex flex-wrap gap-2">
            {personas.map((item) => (
              <button
                key={item}
                className={`h-8 rounded-md px-3 text-sm ${persona === item ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setPersona(item)}
                type="button"
              >
                {item}
              </button>
            ))}
            <Button type="button" variant="outline" onClick={startConversation} disabled={isHistoryLoading || !projectId}>
              {isHistoryLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="h-4 w-4" />
              )}
              New
            </Button>
          </div>
        </div>
        <div className="grid min-h-72 lg:grid-cols-[260px_1fr]">
          <aside className="border-b border-border lg:border-b-0 lg:border-r">
            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
              Conversations
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {sessions.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No chats saved for this project.</div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={`mb-1 block w-full rounded-md px-3 py-2 text-left text-sm ${
                      activeSession?.id === session.id ? 'bg-muted text-foreground' : 'hover:bg-muted/70'
                    }`}
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <span className="block truncate font-medium">{session.title}</span>
                    <span className="block truncate text-xs capitalize text-muted-foreground">{session.persona}</span>
                  </button>
                ))
              )}
            </div>
          </aside>
          <div className="flex min-h-72 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              {message ? <div className="text-muted-foreground">{message}</div> : null}
              {activeSession?.messages.map((chatMessage) => (
                <div
                  key={chatMessage.id}
                  className={`max-w-[86%] rounded-lg border border-border px-3 py-2 ${
                    chatMessage.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-background'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{chatMessage.content}</div>
                  {chatMessage.role === 'assistant' && chatMessage.citations.length > 0 ? (
                    <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                      {chatMessage.citations.map((citation, index) => (
                        <div key={`${chatMessage.id}-${citation.sourceId}-${index}`}>
                          {index + 1}. {citation.label}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {isLoading ? (
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Finding evidence
                </div>
              ) : null}
            </div>
            <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
              <Input name="question" placeholder="Ask how a feature works or what a change impacts" />
              <Button type="submit" disabled={isLoading || !projectId}>
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Ask
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
