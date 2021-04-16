import {Component, EventEmitter, Input, Output} from '@angular/core';
import {flatten} from 'lodash';
import {GeneralsService} from 'src/app/services/generals.service';
import {IDynamicDYPEvent, IDynamicDYPMatch, IDynamicDYPRound, MatchStatus} from 'types';
import {HIDE_COMPLETED} from '../../../../constants';

@Component({
  selector: 'app-dynamic-dyp-rounds',
  templateUrl: './dynamic-dyp-rounds.component.html',
  styleUrls: ['./dynamic-dyp-rounds.component.scss'],
})
export class DynamicDYPRoundsComponent {
  @Input() event: IDynamicDYPEvent;
  @Input() rounds: IDynamicDYPRound[];

  @Output() playerClicked = new EventEmitter<string>();

  hideCompletedRounds: boolean;
  showToggle = false;

  constructor(
      private readonly generals: GeneralsService,
  ) {
    this.hideCompletedRounds = localStorage.getItem(HIDE_COMPLETED) !== 'false';
  }

  ngOnChanges() {
    this.showToggle = this.shouldShowToggle();
  }

  get toggleText() {
    return `${this.hideCompletedRounds ? 'Show' : 'Hide'} Completed Rounds`;
  }

  clickPlayer(name: string, $event: Event) {
    $event.stopPropagation();
    this.playerClicked.emit(name);
  }

  handleClickMatch(match: IDynamicDYPMatch) {
    if (match.status !== MatchStatus.COMPLETE) {
      const players = flatten(match.teams.map(team => team.players));
      const inMatch = players.includes(this.generals.name);

      this.generals.joinLobby(
          `match_${match.number}`, this.event.server, true, !inMatch);
    }
  }

  isMe(player: string): boolean {
    return this.generals.name === player;
  }

  showReady(match: IDynamicDYPMatch, player: string): boolean {
    return match.status === MatchStatus.NOT_STARTED &&
        match.ready.includes(player);
  }

  shouldShowToggle(): boolean {
    if (this.rounds) {
      const roundsCompleted =
          this.rounds.filter(round => round.complete).length;

      return roundsCompleted > 0;
    }
    return false;
  }

  toggleHideCompleted() {
    this.hideCompletedRounds = !this.hideCompletedRounds;
    localStorage.setItem(HIDE_COMPLETED, String(this.hideCompletedRounds));
  }
}