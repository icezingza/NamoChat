// Story Timeline: an append-only chronological log of notable story events
// per chat — stage changes, mood shifts, user-pinned moments. Pure data
// operations; persistence belongs to the store layer.

export type TimelineEventKind = 'stage-change' | 'mood-shift' | 'milestone' | 'note';

export interface TimelineEvent {
  id: string;
  chatId: string;
  kind: TimelineEventKind;
  title: string;
  detail?: string;
  timestamp: number;
}

export const appendEvent = (timeline: TimelineEvent[], event: TimelineEvent): TimelineEvent[] => [
  ...timeline,
  event,
];

export const eventsForChat = (timeline: TimelineEvent[], chatId: string): TimelineEvent[] =>
  timeline.filter((event) => event.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp);

// Compact recap of the latest story beats, suitable for context injection.
export const summarizeRecent = (timeline: TimelineEvent[], chatId: string, limit = 3): string => {
  const recent = eventsForChat(timeline, chatId).slice(-limit);
  if (recent.length === 0) return '';
  return recent.map((event) => `- ${event.title}${event.detail ? `: ${event.detail}` : ''}`).join('\n');
};
