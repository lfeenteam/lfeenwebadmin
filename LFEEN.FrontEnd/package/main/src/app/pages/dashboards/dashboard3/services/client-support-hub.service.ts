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
  ticketExternalId: string;
  ticketNumber: string;
  subject: string;
  department: string;
  createdAt: string;
}

export interface NewClientMessageEvent {
  ticketExternalId: string;
  senderName: string;
  preview: string;
  sentAt: string;
}

export interface NewMessageEvent {
  messageExternalId: string;
  ticketExternalId: string;
  senderType: string;
  senderName: string;
  body: string;
  attachment: HubMessageAttachment | null;
  sentAt: string;
}

export interface TicketAssignedEvent {
  ticketExternalId: string;
  ticketNumber: string;
  subject: string;
}

export interface TicketStatusChangedEvent {
  status: string;
  agentName: string;
}

export interface TypingIndicatorEvent {
  userId: string;
  isAgent: boolean;
  isTyping: boolean;
}

export interface ParticipantPresenceEvent {
  userId: string;
  isAgent: boolean;
}

// Single shared SignalR connection for the Client Support Hub. Connect once when
// entering the d3 section (AppDashboard3Component) and keep it alive across
// navigation — do not reconnect per ticket/component per the API's integration guide.
@Injectable({ providedIn: 'root' })
export class ClientSupportHubService {
  private connection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private joinedTicketId: string | null = null;

  private readonly _newClientTicket = new Subject<NewClientTicketEvent>();
  private readonly _newClientMessage = new Subject<NewClientMessageEvent>();
  private readonly _newMessage = new Subject<NewMessageEvent>();
  private readonly _ticketAssigned = new Subject<TicketAssignedEvent>();
  private readonly _ticketStatusChanged = new Subject<TicketStatusChangedEvent>();
  private readonly _typingIndicator = new Subject<TypingIndicatorEvent>();
  private readonly _participantOnline = new Subject<ParticipantPresenceEvent>();
  private readonly _participantOffline = new Subject<ParticipantPresenceEvent>();

  readonly newClientTicket$ = this._newClientTicket.asObservable();
  readonly newClientMessage$ = this._newClientMessage.asObservable();
  readonly newMessage$ = this._newMessage.asObservable();
  readonly ticketAssigned$ = this._ticketAssigned.asObservable();
  readonly ticketStatusChanged$ = this._ticketStatusChanged.asObservable();
  readonly typingIndicator$ = this._typingIndicator.asObservable();
  readonly participantOnline$ = this._participantOnline.asObservable();
  readonly participantOffline$ = this._participantOffline.asObservable();

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
      if (this.joinedTicketId) {
        connection.invoke('JoinTicket', this.joinedTicketId).catch(err =>
          console.error('JoinTicket after reconnect failed', err)
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
    this.joinedTicketId = null;
    this.connection?.stop();
    this.connection = null;
    this.startPromise = null;
    this.connected.set(false);
  }

  joinTicket(ticketExternalId: string | null | undefined): Promise<void> {
    if (!ticketExternalId) return Promise.resolve();
    this.joinedTicketId = ticketExternalId;
    return this.invoke('JoinTicket', ticketExternalId);
  }

  leaveTicket(ticketExternalId: string | null | undefined): Promise<void> {
    if (!ticketExternalId) return Promise.resolve();
    if (this.joinedTicketId === ticketExternalId) {
      this.joinedTicketId = null;
    }
    return this.invoke('LeaveTicket', ticketExternalId);
  }

  sendTyping(ticketExternalId: string | null | undefined, isTyping: boolean): void {
    if (!ticketExternalId) return;
    this.invoke('Typing', ticketExternalId, isTyping);
  }

  private registerHandlers(connection: signalR.HubConnection): void {
    connection.on('NewClientTicket', (payload: NewClientTicketEvent) => this._newClientTicket.next(payload));
    connection.on('NewClientMessage', (payload: NewClientMessageEvent) => this._newClientMessage.next(payload));
    connection.on('NewMessage', (payload: NewMessageEvent) => this._newMessage.next(payload));
    connection.on('TicketAssigned', (payload: TicketAssignedEvent) => this._ticketAssigned.next(payload));
    connection.on('TicketStatusChanged', (payload: TicketStatusChangedEvent) => this._ticketStatusChanged.next(payload));
    connection.on('TypingIndicator', (payload: TypingIndicatorEvent) => this._typingIndicator.next(payload));
    connection.on('ParticipantOnline', (payload: ParticipantPresenceEvent) => this._participantOnline.next(payload));
    connection.on('ParticipantOffline', (payload: ParticipantPresenceEvent) => this._participantOffline.next(payload));
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
