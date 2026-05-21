import {
  Component,
  OnInit,
  Inject,
  signal,
  inject,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { Category, mailbox, filter, label } from './categories';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  mailGlobalVariable,
  mailService,
} from 'src/app/services/apps/email/email.service';
import { getUser, User } from '../user-data';
import { mailboxList } from '../email-data';
import { Mailbox } from '../email';
import { Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { NgxEditorComponent, NgxEditorMenuComponent, Editor, Toolbar, NgxEditorModule } from 'ngx-editor';

import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { NgxPaginationModule } from 'ngx-pagination';
import { DetailComponent } from '../detail/detail.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MediaMatcher } from '@angular/cdk/layout';
import { NO_ERRORS_SCHEMA } from '@angular/core';
type MailboxType = 'Inbox' | 'Sent' | 'Draft' | 'Spam' | 'Trash';

@Component({
 
  selector: 'app-dialog-data-example-dialog',
  schemas: [NO_ERRORS_SCHEMA], 
  templateUrl: './compose-dialog-content.html',
  imports: [
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    TablerIconsModule,
    NgxEditorModule,
  ],
})
export class ListingDialogDataExampleDialogComponent implements OnInit{
  form: FormGroup;

  html = '';
  editor: Editor;
  htmlContent1 = '';
  toolbar: Toolbar = [
    ['bold', 'italic'],
    ['underline'],
    ['ordered_list', 'bullet_list'],
    [{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
    ['link', 'image'],
    ['text_color', 'background_color'],
    ['align_left', 'align_center', 'align_right', 'align_justify'],
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private formBuilder: FormBuilder
  ) { }
  ngOnInit(): void {
    this.editor = new Editor();

  }


  onChange(event: any) {
    console.log('changed');
  }

  onBlur(event: any) {
    console.log('blur ' + event);
  }
}

@Component({
  selector: 'app-listing',
  templateUrl: './listing.component.html',
  imports: [
    MaterialModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    NgxPaginationModule,
    DetailComponent,
    MatCheckboxModule,
    FormsModule,
   
  ],
 
})
export class ListingComponent implements OnInit, OnDestroy {
  searchText = signal('');
  private mediaMatcher: MediaQueryList = matchMedia(`(max-width: 960px)`);
  sidePanelOpened = signal(true);
  displayMode = signal('default');
  p = signal(1);

  mailboxes = signal<Category[] | any>(mailbox);
  filters = signal<Category[]>(filter);
  labels = signal<Category[]>(label);
  selectedIndex = signal<string>('');
  activeFilter = signal<string | null>(null);
  activeLabel = signal<string | null>(null);
  isChecked = false;
  showDetail = signal(false);

  mobileQuery: MediaQueryList;

  private _mobileQueryListener: () => void;

  constructor(
    public ms: mailGlobalVariable,
    public mailService: mailService,
    public router: Router,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    if (!this.ms.type()) {
      this.router.navigate(['apps/email/inbox']);
    }
    this.ms.type.set('inbox');
    const changeDetectorRef = inject(ChangeDetectorRef);
    const media = inject(MediaMatcher);
    this.mobileQuery = media.matchMedia('(max-width: 600px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }

  ngOnDestroy(): void {
    this.mobileQuery.removeListener(this._mobileQueryListener);
  }

  isOver(): boolean {
    return window.innerWidth < 1199;
  }

  ngOnInit(): void {
   
    this.loadMailboxes();
    this.ms.topLabel.set('Inbox');
    this.selectFirstMail();
    window.addEventListener('resize', () => {
      this.showDetail.set(false);
    });
  }

  private selectFirstMail(): void {
    const inboxMails = this.ms.inboxList();
    if (inboxMails.length > 0) {
      this.mailSelected(inboxMails[0]);
    }
  }

  private loadMailboxes(): void {
    this.ms.inboxList.set(this.mailService.getInbox());
    this.ms.sentList.set(this.mailService.getSent());
    this.ms.draftList.set(this.mailService.getDraft());
    this.ms.spamList.set(this.mailService.getSpam());
    this.ms.trashList.set(this.mailService.getTrash());

    this.updateMailListAndUsers(this.ms.inboxList());
  }

  private updateMailListAndUsers(mailList: Mailbox[]): void {
    this.ms.mailList.set(mailList);
    this.ms.collectionSize.set(mailList.length);
    this.ms.users.set(this.extractUsers(mailList));
  }

  private extractUsers(mailList: Mailbox[]): User[] | any {
    return mailList
      .map((mail) => getUser(mail.fromId))
      .filter((user) => user !== null);
  }

  mailSelected(mail: Mailbox): void {
    const currentMailbox = this.ms.mailList(); // Get the current mailbox
    const mailExists = currentMailbox.some(
      (item: { MailId: string }) => item.MailId === mail.MailId
    );

    if (!mailExists) {
      this.ms.selectedMail.set(null); // Clear selected mail if it doesn't exist
      this.selectedIndex.set(''); // Clear selected index
      return; // Exit early if the mail does not exist
    }

    // Set the selected mail and mark it as seen
    this.ms.selectedMail.set(mail);
    mail.seen = true;
    this.ms.selectedUser.set(getUser(mail.fromId));
    this.selectedIndex.set(mail.MailId);

    if (this.isOver()) {
      this.showDetail.set(true); // Show detail on smaller screens
    }
  }

  mailboxesChanged(type: MailboxType): void {
    const listMap: Record<MailboxType, () => Mailbox[]> = {
      Inbox: this.ms.inboxList,
      Sent: this.ms.sentList,
      Draft: this.ms.draftList,
      Spam: this.ms.spamList,
      Trash: this.ms.trashList,
    };

    // Get the mails based on the selected mailbox type
    let filteredMails = listMap[type]();

    // Exclude emails that are in Trash for all filters except Trash
    if (type !== 'Trash') {
      filteredMails = filteredMails.filter((mail) => mail.mailbox !== 'Trash');
    }
    this.p.set(1);
    // Apply the selected filter and update the displayed mail list
    this.updateMailListAndUsers(filteredMails);
    this.ms.topLabel.set(type);
    this.mailActiveClass(type);
    this.ms.type.set(type.toLowerCase());
    this.router.navigate([`apps/email/${type.toLowerCase()}`]);
  }

  mailActiveClass(type: string): void {
    mailbox.forEach((mail) => (mail.active = mail.name === type));
  }
  iconsClick(name: string): void {
    this.ms.toggleStar(name);
  }
  filtersClick(type: string): void {
    this.activeLabel.set(null);
    this.activeFilter.set(type);
    this.mailActiveClass('');

    this.p.set(1);
    // Filter mails based on the filter type (Starred, Important, etc.)
    let filteredMails = mailboxList.filter((mail) =>
      mail.filter.includes(type)
    );

    // Exclude Trash emails from the filter results
    filteredMails = filteredMails.filter((mail) => mail.mailbox !== 'Trash');

    this.updateMailListAndUsers(filteredMails);
    this.ms.topLabel.set(type);
    this.mailActiveClass(type);
    this.ms.type.set(type.toLowerCase());
    this.router.navigate([`apps/email/${type.toLowerCase()}`]);
  }

  labelChange(type: string): void {
    this.activeFilter.set(null);
    this.activeLabel.set(type);
    this.mailActiveClass('');
    this.p.set(1);
    // Filter mails based on the selected label
    let labeledMails = mailboxList.filter((mail) => mail.label.includes(type));

    // Exclude Trash emails from the label filter
    labeledMails = labeledMails.filter((mail) => mail.mailbox !== 'Trash');

    this.updateMailListAndUsers(labeledMails);
    this.ms.topLabel.set(type);
    this.ms.type.set(type);
    this.router.navigate([`apps/email/${type.toLowerCase()}`]);
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(
      ListingDialogDataExampleDialogComponent,
      { autoFocus: false }
    );
    dialogRef.afterClosed().subscribe((result) => {
      console.log(`Dialog result: ${result}`);
    });
  }

  deleteItem(mail: Mailbox): void {
    const snackBarRef = this.snackBar.open(
      'Are you sure you want to delete this mail?',
      'Delete',
      {
        duration: 15000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
      }
    );
    snackBarRef.onAction().subscribe(() => {
      // Remove the email from its current mailbox (Inbox, Sent, etc.)
      let updatedList: Mailbox[] = [];

      // Depending on the mailbox, filter out the deleted email
      if (mail.mailbox === 'Inbox') {
        updatedList = this.ms
          .inboxList()
          .filter((item: any) => item.MailId !== mail.MailId);
        this.ms.inboxList.set(updatedList);
      } else if (mail.mailbox === 'Sent') {
        updatedList = this.ms
          .sentList()
          .filter((item) => item.MailId !== mail.MailId);
        this.ms.sentList.set(updatedList);
      } else if (mail.mailbox === 'Draft') {
        updatedList = this.ms
          .draftList()
          .filter((item) => item.MailId !== mail.MailId);
        this.ms.draftList.set(updatedList);
      } else if (mail.mailbox === 'Spam') {
        updatedList = this.ms
          .spamList()
          .filter((item) => item.MailId !== mail.MailId);
        this.ms.spamList.set(updatedList);
      }

      // Now, move the email to Trash (do not remove it entirely)
      mail.mailbox = 'Trash';
      this.ms.trashList.set([...this.ms.trashList(), mail]);
      mail.isChecked = false;
      this.ms.selectedMail.set(null);

      // Update the mail list and users after moving the email to Trash
      this.updateMailListAndUsers(updatedList);
    });
  }

  onCheckboxChange(selectedMail: Mailbox): void {
    this.mailboxes().forEach((mail: { MailId: string; isChecked: boolean }) => {
      if (mail.MailId !== selectedMail.MailId) {
        mail.isChecked = false;
      }
    });

    selectedMail.isChecked = true;
  }
}
function selectedMail(): Mailbox {
  throw new Error('Function not implemented.');
}
