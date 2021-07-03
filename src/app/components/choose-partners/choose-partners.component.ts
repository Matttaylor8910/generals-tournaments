import {Component, Input} from '@angular/core';
import {EventService} from 'src/app/services/event.service';
import {GeneralsService} from 'src/app/services/generals.service';
import {EventStatus, IDoubleElimEvent, ILeaderboardPlayer, PartnerStatus} from 'types';

@Component({
  selector: 'app-choose-partners',
  templateUrl: './choose-partners.component.html',
  styleUrls: ['./choose-partners.component.scss'],
})
export class ChoosePartnersComponent {
  @Input() event: IDoubleElimEvent;
  @Input() players: ILeaderboardPlayer[];
  @Input() status: EventStatus;
  @Input() disqualified: boolean;

  constructor(
      private readonly generals: GeneralsService,
      private readonly eventService: EventService,
  ) {}

  get me(): ILeaderboardPlayer {
    return this.players?.find(player => player.name === this.generals.name);
  }

  get showPartners(): boolean {
    return this.status === EventStatus.UPCOMING &&
        this.event?.checkedInPlayers?.includes(this.generals.name);
  }

  get takingRequests(): boolean {
    return this.me?.partnerStatus !== PartnerStatus.CONFIRMED;
  }

  get confirmedTeams(): string[][] {
    const teams = [];
    const paired = new Set<string>();

    // create the teams
    for (const player of this.players) {
      if (!paired.has(player.name) &&
          player.partnerStatus === PartnerStatus.CONFIRMED && player.partner) {
        teams.push([player.name, player.partner].sort());
        paired.add(player.name);
        paired.add(player.partner);
      }
    }

    return teams;
  }

  get availablePartners(): ILeaderboardPlayer[] {
    return this.players
        ?.filter(player => {
          return this.event?.checkedInPlayers?.includes(player.name) &&
              player.name !== this.generals.name &&
              player.partnerStatus !== PartnerStatus.CONFIRMED;
        })
        .sort((a, b) => {
          return a.name.localeCompare(b.name);
        });
  }

  get partnerRequests(): ILeaderboardPlayer[] {
    return this.players.filter(player => {
      return player.partner === this.generals.name &&
          player.partnerStatus === PartnerStatus.PENDING;
    });
  }

  onTeam(team: string[]): boolean {
    return team.includes(this.generals.name);
  }

  choosePartner(player: ILeaderboardPlayer) {
    this.eventService.selectPartner(
        this.event.id, this.generals.name, player.name);
  }

  acceptPartner(player: ILeaderboardPlayer) {
    this.eventService.confirmPartner(
        this.event.id, this.generals.name, player.name);
  }

  leaveTeam() {
    this.eventService.clearPartner(
        this.event.id, this.generals.name, this.me?.partner);
  }

  trackByFn(index: number) {
    return index;
  }
}
