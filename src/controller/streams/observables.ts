import {
  combineLatest,
  delayWhen,
  from,
  fromEvent,
  map,
  merge,
  Observable,
  of,
  scan,
  Subject,
  switchMap,
  takeUntil,
  timer,
  withLatestFrom,
  zip,
} from "rxjs";
import { API_URL, CLASSES, INDEXES, PLAY_AGAIN_TIMER } from "../../constants";
import { DifficultyLevel } from "../../enums/DifficultyLevelEnum";
import { Method } from "../../enums/MethodEnum";
import { Round } from "../../enums/RoundEnum";
import { WeightClass } from "../../enums/WeightClassEnum";
import { Fight } from "../../model/fight";
import { FightCard } from "../../model/fightCard";
import { Fighter } from "../../model/fighter";
import { Opponent } from "../../model/opponent";
import { Result } from "../../model/result";
import {
  enableElement,
  getCheckedRadioValue,
  getSelectedValue,
  selectElement,
  selectSelectionEl,
} from "../../view/view";
import {
  checkAddingPick,
  getDifficulties,
  getFighterId,
  getRandomOpponent,
  getWeightClasses,
  initFighterFromArray,
} from "../main";

export function createButtonObs(container: HTMLElement, selection: string) {
  let btn = selectElement(container, selection);
  return fromEvent(btn, "click");
}

export function createSelectOptionObs(
  container: HTMLDivElement,
  selection: string
) {
  let select = selectSelectionEl(container, selection);
  return fromEvent(select, "change");
}

export function createControlFlowObs() {
  return new Subject();
}

export function completeControlFlowObs(controlStartGameOb$: Subject<any>) {
  controlStartGameOb$.next(1);
  controlStartGameOb$.complete();
}

function getOpponents(difficulty: DifficultyLevel): Observable<Opponent[]> {
  return from(
    fetch(`${API_URL}/opponents/?difficulty=${difficulty}`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else throw new Error("Fetch error");
      })
      .catch((err) => console.error(err))
  );
}

export function getFightersByWeightClass(
  weightClass: WeightClass
): Observable<Fighter[]> {
  return from(
    fetch(`${API_URL}/fighters/?weightClass=${weightClass}`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else throw new Error("Fetch error");
      })
      .catch((err) => console.error(err))
  );
}

function getFighterById(id: number): Observable<Fighter[]> {
  return from(
    fetch(`${API_URL}/fighters/?id=${id}`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else throw new Error("Fetch error");
      })
      .catch((err) => console.error(err))
  );
}

export function getFightersFromForm(
  container: HTMLDivElement,
  fightCard: FightCard
): Observable<Fighter[]> {
  if (checkAddingPick(container, fightCard) == false) {
    let emptyArray: Fighter[] = [];
    return of(emptyArray);
  }

  const blueCornerId = getSelectedValue(container, CLASSES.BLUE_CORNER_SEL);
  const redCornerId = getSelectedValue(container, CLASSES.RED_CORNER_SEL);

  return from(
    fetch(`${API_URL}/fighters/?id=${blueCornerId}&id=${redCornerId}`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else throw new Error("Fetch error");
      })
      .catch((err) => console.error(err))
  );
}

export function addFightToFightCardObs(
  container: HTMLDivElement,
  fightCard: FightCard,
  fightersArray: Fighter[]
): Observable<FightCard> {
  return new Observable<FightCard>((generator) => {
    if (fightersArray.length === 0) {
      generator.next(fightCard);
      return;
    }
    let fight = new Fight();

    let blueCornerFighter = initFighterFromArray(
      fightersArray,
      INDEXES.BLUE_CORNER
    );
    let redCornerFighter = initFighterFromArray(
      fightersArray,
      INDEXES.RED_CORNER
    );
    fight.setFighters(blueCornerFighter, redCornerFighter, container);

    let winnerValue = getCheckedRadioValue(container, CLASSES.CORNER_RADIO);
    let methodValue = getSelectedValue(container, CLASSES.METHOD_SEL);
    let roundValue: string;
    if (methodValue === Method.Decision) {
      roundValue = Round.Round_3.toString();
    } else {
      roundValue = getSelectedValue(container, CLASSES.ROUND_SEL);
    }

    let yourPick = new Result(winnerValue, methodValue, roundValue);
    fight.setYourPick(yourPick);

    let yourFightCardDiv = selectElement(container, CLASSES.YOUR_FIGHTCARD_DIV);
    fight.createYourFightDiv();
    fightCard.fights.push(fight);

    fightCard.renderYourPicksDivs(yourFightCardDiv);

    //console.log("niz", fightCard);
    generator.next(fightCard);
  });
}

export function createAddNewPickObs(
  container: HTMLDivElement,
  selection: string,
  fightCard: FightCard
): Observable<FightCard> {
  return createButtonObs(container, selection).pipe(
    switchMap(() => getFightersFromForm(container, fightCard)),
    switchMap((fightersArray) =>
      addFightToFightCardObs(container, fightCard, fightersArray)
    )
  );
}

export function createFindingOpponentObs(
  findingOpponentDiv: HTMLDivElement,
  controlStartGameOb$: Subject<any>
): Observable<Opponent> {
  return createButtonObs(findingOpponentDiv, CLASSES.FINDING_OPP_BTN).pipe(
    switchMap(() => getOpponents(getDifficulties(findingOpponentDiv))),
    map((opponents) => getRandomOpponent(opponents)),
    takeUntil(controlStartGameOb$)
  );
}

export function createChangeWeightClassObs(
  container: HTMLDivElement,
  selection: string
) {
  return createSelectOptionObs(container, selection).pipe(
    switchMap(() => getFightersByWeightClass(getWeightClasses(container)))
  );
}

export function createChangeFighterObs(
  container: HTMLDivElement,
  selection: string
): Observable<Fighter> {
  return createSelectOptionObs(container, selection).pipe(
    switchMap(() => getFighterById(getFighterId(container, selection))),
    map((fightersArray) =>
      initFighterFromArray(fightersArray, INDEXES.INITIAL_FIGHTER)
    )
  );
}

export function createPlayObs(
  container: HTMLDivElement,
  selection: string,
  fightCard: FightCard,
  addNewPickOb$: Observable<FightCard>
): Observable<FightCard> {
  let playOb$ = createButtonObs(container, selection).pipe(
    withLatestFrom(addNewPickOb$),
    map((obsArray) => obsArray[1])
  );
  return playOb$;
}

export function createPlayAgainObs(
  container: HTMLDivElement,
  selectionPlay: string,
  selectionPlayAgain: string
) {
  // let buttonOb$ = createButtonObs(container, selection);
  // let playAgainOb$ = combineLatest([playOb$, buttonOb$])
  // .pipe(map((fightCard) => playAgain(container, fightCard[0]))
  // );
  // return playAgainOb$;
  let buttonOb$ = createButtonObs(container, selectionPlayAgain);
  let waitOb$ = createButtonObs(container, selectionPlay).pipe(
    delayWhen(() => timer(PLAY_AGAIN_TIMER))
  );

  return merge(buttonOb$, waitOb$);
}
