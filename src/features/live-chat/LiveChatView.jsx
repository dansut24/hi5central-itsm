import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronDown,
  Circle,
  MessageCircle,
  Search,
  Send,
  Settings,
  UserRoundCheck,
  X,
} from 'lucide-react'
import './LiveChatView.css'

const FILTERS = ['All', 'Open', 'Waiting', 'Closed']

function presenceClass(presence = '') {
  return presence.toLowerCase().replace(/\s+/g, '-')
}

function conversationMatches(conversation, filter, query) {
  const matchesFilter = filter === 'All' || conversation.status === filter
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return matchesFilter

  const haystack = [
    conversation.participant?.name,
    conversation.participant?.email,
    conversation.subject,
    conversation.lastMessage,
    conversation.team,
  ].join(' ').toLowerCase()

  return matchesFilter && haystack.includes(normalizedQuery)
}

function Avatar({ participant, size = 'normal' }) {
  return (
    <span className={`live-chat-avatar ${size}`} aria-hidden="true">
      {participant?.initials || '?'}
      <span className={`live-chat-presence ${presenceClass(participant?.presence)}`} />
    </span>
  )
}

export function LiveChatView({
  conversations,
  currentUser,
  onClaimConversation,
  onCloseConversation,
  onDisableLiveChat,
  onMarkRead,
  onSendMessage,
  onUpdatePreferences,
  preferences,
  selectedConversationId,
  setSelectedConversationId,
}) {
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)
  const composerRef = useRef(null)

  const filteredConversations = useMemo(
    () => conversations.filter((conversation) => conversationMatches(conversation, filter, query)),
    [conversations, filter, query],
  )

  const selectedConversation = filteredConversations.find(
    (conversation) => conversation.id === selectedConversationId,
  ) || filteredConversations[0] || conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  ) || conversations[0]

  const counts = useMemo(() => ({
    All: conversations.length,
    Open: conversations.filter((conversation) => conversation.status === 'Open').length,
    Waiting: conversations.filter((conversation) => conversation.status === 'Waiting').length,
    Closed: conversations.filter((conversation) => conversation.status === 'Closed').length,
  }), [conversations])

  function openConversation(conversation) {
    setSelectedConversationId(conversation.id)
    onMarkRead(conversation.id)
    setMobileThreadOpen(true)
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  function submitMessage(event) {
    event?.preventDefault()
    const body = draft.trim()
    if (!body || !selectedConversation || selectedConversation.status === 'Closed') return
    onSendMessage(selectedConversation.id, body)
    setDraft('')
  }

  function handleComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || !preferences.enterToSend) return
    event.preventDefault()
    submitMessage()
  }

  return (
    <div className={`live-chat-view ${mobileThreadOpen ? 'mobile-thread-open' : ''}`}>
      <section className="live-chat-inbox" aria-label="Live Chat conversations">
        <div className="live-chat-inbox-header">
          <div>
            <span className="eyebrow">Support messenger</span>
            <h2>Live Chat</h2>
          </div>
          <div className="live-chat-header-actions">
            <span className={`availability-pill ${presenceClass(preferences.availability)}`}>
              <Circle size={8} fill="currentColor" aria-hidden="true" />
              {preferences.availability}
            </span>
            <button
              aria-label="Open Live Chat settings"
              className="live-chat-icon-button"
              onClick={() => setSettingsOpen(true)}
              title="Live Chat settings"
              type="button"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <label className="live-chat-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search chats"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            value={query}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery('')} type="button">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="live-chat-filters" role="tablist" aria-label="Conversation filters">
          {FILTERS.map((item) => (
            <button
              aria-selected={filter === item}
              className={filter === item ? 'active' : ''}
              key={item}
              onClick={() => setFilter(item)}
              role="tab"
              type="button"
            >
              <span>{item}</span>
              <strong>{counts[item]}</strong>
            </button>
          ))}
        </div>

        <div className="live-chat-conversation-list">
          {filteredConversations.map((conversation) => (
            <button
              className={[
                'live-chat-conversation-card',
                selectedConversation?.id === conversation.id ? 'active' : '',
                conversation.unread ? 'unread' : '',
              ].filter(Boolean).join(' ')}
              key={conversation.id}
              onClick={() => openConversation(conversation)}
              type="button"
            >
              <Avatar participant={conversation.participant} />
              <span className="live-chat-conversation-copy">
                <span className="live-chat-conversation-topline">
                  <strong>{conversation.participant.name}</strong>
                  <small>{conversation.updatedAt}</small>
                </span>
                <span className="live-chat-conversation-subject">{conversation.subject}</span>
                <span className="live-chat-conversation-preview">
                  {preferences.messagePreviews ? conversation.lastMessage : 'Message preview hidden'}
                </span>
                <span className="live-chat-conversation-meta">
                  <span className={`chat-status ${conversation.status.toLowerCase()}`}>{conversation.status}</span>
                  <span>{conversation.team}</span>
                </span>
              </span>
              {conversation.unread > 0 && (
                <span className="live-chat-unread-count" aria-label={`${conversation.unread} unread messages`}>
                  {conversation.unread}
                </span>
              )}
            </button>
          ))}

          {!filteredConversations.length && (
            <div className="live-chat-list-empty">
              <MessageCircle size={26} aria-hidden="true" />
              <strong>No chats found</strong>
              <span>Try another search or conversation filter.</span>
            </div>
          )}
        </div>
      </section>

      <section className="live-chat-thread" aria-label="Selected conversation">
        {selectedConversation ? (
          <>
            <header className="live-chat-thread-header">
              <button
                aria-label="Back to chats"
                className="live-chat-mobile-back"
                onClick={() => setMobileThreadOpen(false)}
                type="button"
              >
                <ArrowLeft size={19} aria-hidden="true" />
              </button>
              <Avatar participant={selectedConversation.participant} />
              <div className="live-chat-thread-person">
                <strong>{selectedConversation.participant.name}</strong>
                <span>{selectedConversation.participant.role} · {selectedConversation.participant.presence}</span>
              </div>
              <div className="live-chat-thread-actions">
                {selectedConversation.status === 'Waiting' && (
                  <button
                    className="live-chat-action primary"
                    onClick={() => onClaimConversation(selectedConversation.id)}
                    type="button"
                  >
                    <UserRoundCheck size={15} aria-hidden="true" />
                    Claim
                  </button>
                )}
                <button
                  aria-label="Open Live Chat settings"
                  className="live-chat-icon-button"
                  onClick={() => setSettingsOpen(true)}
                  title="Live Chat settings"
                  type="button"
                >
                  <Settings size={18} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="live-chat-thread-summary">
              <div>
                <span>{selectedConversation.id}</span>
                <strong>{selectedConversation.subject}</strong>
              </div>
              <div className="live-chat-thread-summary-meta">
                <span>{selectedConversation.team}</span>
                <span>Assigned: {selectedConversation.assignedTo || 'Unassigned'}</span>
                <button
                  className={selectedConversation.status === 'Closed' ? 'reopen' : ''}
                  onClick={() => onCloseConversation(selectedConversation.id)}
                  type="button"
                >
                  {selectedConversation.status === 'Closed' ? 'Reopen chat' : 'Close chat'}
                </button>
              </div>
            </div>

            <div className="live-chat-messages" role="log" aria-live="polite">
              <div className="live-chat-day-divider"><span>Today</span></div>
              {selectedConversation.messages.map((message) => (
                message.sender === 'system' ? (
                  <div className="live-chat-system-message" key={message.id}>
                    <span>{message.text}</span>
                    <small>{message.time}</small>
                  </div>
                ) : (
                  <div
                    className={`live-chat-message-row ${message.sender === 'agent' ? 'agent' : 'requester'}`}
                    key={message.id}
                  >
                    {message.sender === 'requester' && <Avatar participant={selectedConversation.participant} size="small" />}
                    <div className="live-chat-message-bubble">
                      <p>{message.text}</p>
                      <span>
                        {message.time}
                        {message.sender === 'agent' && (
                          <CheckCheck size={13} aria-label={message.state || 'Sent'} />
                        )}
                      </span>
                    </div>
                  </div>
                )
              ))}
            </div>

            <form className="live-chat-composer" onSubmit={submitMessage}>
              {selectedConversation.status === 'Closed' ? (
                <div className="live-chat-closed-composer">
                  <span>This conversation is closed.</span>
                  <button onClick={() => onCloseConversation(selectedConversation.id)} type="button">Reopen to reply</button>
                </div>
              ) : (
                <>
                  <textarea
                    aria-label="Type a message"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`Message ${selectedConversation.participant.name}`}
                    ref={composerRef}
                    rows={1}
                    value={draft}
                  />
                  <button
                    aria-label="Send message"
                    className="live-chat-send-button"
                    disabled={!draft.trim()}
                    title="Send message"
                    type="submit"
                  >
                    <Send size={17} aria-hidden="true" />
                  </button>
                </>
              )}
            </form>
          </>
        ) : (
          <div className="live-chat-thread-empty">
            <MessageCircle size={42} aria-hidden="true" />
            <strong>Your conversations</strong>
            <span>Select a chat from the left to start messaging.</span>
          </div>
        )}
      </section>

      {settingsOpen && (
        <>
          <button
            aria-label="Close Live Chat settings"
            className="live-chat-settings-backdrop"
            onClick={() => setSettingsOpen(false)}
            type="button"
          />
          <aside className="live-chat-settings-panel" aria-label="Live Chat settings">
            <div className="live-chat-settings-heading">
              <div>
                <span className="eyebrow">Personal settings</span>
                <h3>Live Chat</h3>
              </div>
              <button aria-label="Close settings" className="live-chat-icon-button" onClick={() => setSettingsOpen(false)} type="button">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <label className="live-chat-setting-field">
              <span>Availability</span>
              <div className="live-chat-select-wrap">
                <select
                  onChange={(event) => onUpdatePreferences({ availability: event.target.value })}
                  value={preferences.availability}
                >
                  <option>Online</option>
                  <option>Busy</option>
                  <option>Away</option>
                  <option>Offline</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </div>
            </label>

            <button
              aria-pressed={preferences.soundEnabled}
              className="live-chat-toggle-setting"
              onClick={() => onUpdatePreferences({ soundEnabled: !preferences.soundEnabled })}
              type="button"
            >
              <span><Bell size={17} aria-hidden="true" /><span><strong>Notification sound</strong><small>Play a sound when a new chat message arrives.</small></span></span>
              <span className={preferences.soundEnabled ? 'toggle-switch on' : 'toggle-switch'}><span /></span>
            </button>

            <button
              aria-pressed={preferences.messagePreviews}
              className="live-chat-toggle-setting"
              onClick={() => onUpdatePreferences({ messagePreviews: !preferences.messagePreviews })}
              type="button"
            >
              <span><MessageCircle size={17} aria-hidden="true" /><span><strong>Message previews</strong><small>Show the latest message in the conversation list.</small></span></span>
              <span className={preferences.messagePreviews ? 'toggle-switch on' : 'toggle-switch'}><span /></span>
            </button>

            <button
              aria-pressed={preferences.enterToSend}
              className="live-chat-toggle-setting"
              onClick={() => onUpdatePreferences({ enterToSend: !preferences.enterToSend })}
              type="button"
            >
              <span><Send size={17} aria-hidden="true" /><span><strong>Enter to send</strong><small>Use Shift + Enter when you need a new line.</small></span></span>
              <span className={preferences.enterToSend ? 'toggle-switch on' : 'toggle-switch'}><span /></span>
            </button>

            <div className="live-chat-settings-user">
              <span className="live-chat-settings-user-avatar">{currentUser?.initials || 'HC'}</span>
              <div><strong>{currentUser?.name || 'Hi5Central user'}</strong><span>{currentUser?.username}</span></div>
            </div>

            <button className="live-chat-disable-button" onClick={onDisableLiveChat} type="button">
              Disable Live Chat workspace
            </button>
          </aside>
        </>
      )}
    </div>
  )
}
