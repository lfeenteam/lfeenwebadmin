import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { LoginService } from './login/login.service';
import { environment } from 'src/environments/environment';

export interface HubMessageAttachment {
  fileName: string;
  url: string;
  contentType: string;
}

export interface NewClientTicketEvent {
  sessionExternalId: string;
  sessionNumber: string;
  department: string;
  createdAt: string;
}

export interface SessionEscalatedEvent {
  sessionExternalId: string;
  sessionNumber: string;
  department: string;
  createdAt: string;
}

// ChatMessageBroadcast — fires for any message in a room this connection has joined.
export interface NewMessageEvent {
  externalId: string;
  chatExternalId: string;
  senderType: string;
  senderName: string;
  body: string;
  optionsJson: string | null;
  attachment: HubMessageAttachment | null;
  sentAt: string;
}

// Personal notification to the assigned agent when a client messages a ticket that
// isn't the one currently open in this tab.
export interface NewClientMessageEvent {
  chatExternalId: string;
  sessionExternalId: string;
  senderName: string;
  preview: string;
  sentAt: string;
}

// Personal variant (to the claiming agent) carries sessionExternalId; the room
// broadcast to everyone else doesn't.
export interface SessionClaimedEvent {
  sessionExternalId?: string;
  status: string;
  agentName: string;
}

export interface AgentReleasedEvent {
  sessionExternalId: string;
  reason: string;
  requeued: boolean;
}

// Personal — only sent to the agent who lost the session.
export interface SessionReleasedEvent {
  sessionExternalId: string;
  reason: string;
  requeued: boolean;
}

export interface SessionResolvedEvent {
  sessionExternalId: string;
  status: string;
}

export interface MessagesSeenEvent {
  readerType: string;
  readAtUtc: string;
}

export interface TypingIndicatorEvent {
  userId: string;
  isAgent: boolean;
  isTyping: boolean;
}

// Single shared SignalR connection for the Client Support Hub. Connect once when
// entering the d3 section (AppDashboard3Component) and keep it alive across
// navigation — do not reconnect per ticket/component per the API's integration guide.
@Injectable({ providedIn: 'root' })
export class ClientSupportHubService {
  private connection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private joinedChatId: string | null = null;

  private readonly _newClientTicket = new Subject<NewClientTicketEvent>();
  private readonly _sessionEscalated = new Subject<SessionEscalatedEvent>();
  private readonly _newMessage = new Subject<NewMessageEvent>();
  private readonly _newClientMessage = new Subject<NewClientMessageEvent>();
  private readonly _sessionClaimed = new Subject<SessionClaimedEvent>();
  private readonly _agentReleased = new Subject<AgentReleasedEvent>();
  private readonly _sessionReleased = new Subject<SessionReleasedEvent>();
  private readonly _sessionResolved = new Subject<SessionResolvedEvent>();
  private readonly _messagesSeen = new Subject<MessagesSeenEvent>();
  private readonly _typingIndicator = new Subject<TypingIndicatorEvent>();

  readonly newClientTicket$ = this._newClientTicket.asObservable();
  readonly sessionEscalated$ = this._sessionEscalated.asObservable();
  readonly newMessage$ = this._newMessage.asObservable();
  readonly newClientMessage$ = this._newClientMessage.asObservable();
  readonly sessionClaimed$ = this._sessionClaimed.asObservable();
  readonly agentReleased$ = this._agentReleased.asObservable();
  readonly sessionReleased$ = this._sessionReleased.asObservable();
  readonly sessionResolved$ = this._sessionResolved.asObservable();
  readonly messagesSeen$ = this._messagesSeen.asObservable();
  readonly typingIndicator$ = this._typingIndicator.asObservable();

  readonly connected = signal(false);

  constructor(private loginService: LoginService) {}

  connect(): void {
    if (this.connection) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/client-support`, {
        accessTokenFactory: () => this.loginService.getToken() ?? '',
      })
      .withAutomaticReconnect()
      .build();

    this.registerHandlers(connection);

    connection.onreconnected(() => {
      this.connected.set(true);
      if (this.joinedChatId) {
        connection.invoke('JoinChat', this.joinedChatId).catch(err =>
          console.error('JoinChat after reconnect failed', err)
        );
      }
    });
    connection.onreconnecting(() => this.connected.set(false));
    connection.onclose(() => this.connected.set(false));

    this.connection = connection;
    this.startPromise = connection
      .start()
      .then(() => this.connected.set(true))
      .catch(err => {
        console.error('Client support hub connection failed', err);
        throw err;
      });
  }

  disconnect(): void {
    this.joinedChatId = null;
    this.connection?.stop();
    this.connection = null;
    this.startPromise = null;
    this.connected.set(false);
  }

  joinChat(chatExternalId: string | null | undefined): Promise<void> {
    if (!chatExternalId) return Promise.resolve();
    this.joinedChatId = chatExternalId;
    return this.invoke('JoinChat', chatExternalId);
  }

  leaveChat(chatExternalId: string | null | undefined): Promise<void> {
    if (!chatExternalId) return Promise.resolve();
    if (this.joinedChatId === chatExternalId) {
      this.joinedChatId = null;
    }
    return this.invoke('LeaveChat', chatExternalId);
  }

  sendTyping(chatExternalId: string | null | undefined, isTyping: boolean): void {
    if (!chatExternalId) return;
    this.invoke('Typing', chatExternalId, isTyping);
  }

  // Call right after joining a chat, and again whenever NewMessage arrives while
  // that chat is the one open on screen.
  markSeen(chatExternalId: string | null | undefined): void {
    if (!chatExternalId) return;
    this.invoke('MarkSeen', chatExternalId);
  }

  private registerHandlers(connection: signalR.HubConnection): void {
    connection.on('NewClientTicket', (payload: NewClientTicketEvent) => this._newClientTicket.next(payload));
    connection.on('SessionEscalated', (payload: SessionEscalatedEvent) => this._sessionEscalated.next(payload));
    connection.on('NewMessage', (payload: NewMessageEvent) => this._newMessage.next(payload));
    connection.on('NewClientMessage', (payload: NewClientMessageEvent) => this._newClientMessage.next(payload));
    connection.on('SessionClaimed', (payload: SessionClaimedEvent) => this._sessionClaimed.next(payload));
    connection.on('AgentReleased', (payload: AgentReleasedEvent) => this._agentReleased.next(payload));
    connection.on('SessionReleased', (payload: SessionReleasedEvent) => this._sessionReleased.next(payload));
    connection.on('SessionResolved', (payload: SessionResolvedEvent) => this._sessionResolved.next(payload));
    connection.on('MessagesSeen', (payload: MessagesSeenEvent) => this._messagesSeen.next(payload));
    connection.on('TypingIndicator', (payload: TypingIndicatorEvent) => this._typingIndicator.next(payload));
  }

  private invoke(method: string, ...args: unknown[]): Promise<void> {
    const connection = this.connection;
    const startPromise = this.startPromise;
    if (!connection || !startPromise) return Promise.resolve();

    return startPromise
      .then(() => {
        // withAutomaticReconnect() can leave the connection in 'Reconnecting'/'Connecting'
        // between the initial start() resolving and a later invoke() call — sending in
        // that window is what produces server-side "No Connection with that ID" errors.
        if (connection.state !== signalR.HubConnectionState.Connected) {
          console.warn(`${method} skipped — hub state is '${connection.state}', not Connected`);
          return;
        }
        return connection.invoke(method, ...args);
      })
      .catch(err => console.error(`${method} failed`, err));
  }
}
