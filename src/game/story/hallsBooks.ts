import type { AnimId } from "../art/characters";
import type { DaoId } from "../engine/dao";
import type { GreatDaoId } from "../engine/comprehension";
import type { GameState } from "../engine/state";
import { CULT, shift } from "../engine/cultivation";
import type { RoommateKey } from "../world/halls";

/**
 * The words of the Ten Halls (story/halls.ts composes the quests): ten
 * books, one for each hall of the Sect of Ten Thousand Daos and the Great
 * Dao it teaches. Each book is a tale of its own told in hand-written beats
 * (the Grand Selection and Room Seven in the first, a dying garden, a hall
 * with no walls, a weeping furnace, tunnels under the court, an unfinished
 * sword, a false accusation, a frozen library, a sleeping sickness, and the
 * sealed Hall of the Void at the last), and between the beats the ordinary
 * life of an outer disciple: lectures, chores, missions, bouts in the ring,
 * long sittings, and her five roommates.
 */

/** A line of a beat: someone speaks (a cast key, "hero" or "narr"), or someone moves. */
export type BeatLine = [string, string] | { a: string; n: AnimId };

export interface BeatOption {
  heart: DaoId;
  label: string;
  /** What she does, narrated. */
  then: string;
  /** What is said back, and by whom (a cast key). */
  reply: [string, string];
  effect?: (g: GameState) => GameState;
}

export interface Beat {
  step: number;
  /** Who she must speak to (a cast key). */
  npc: string;
  title: string;
  objective: string;
  lines: BeatLine[];
  choice?: { prompt: string; options: BeatOption[] };
  after?: BeatLine[];
  /** Narrated once it is done (the journal line of what happened). */
  done: string;
  /** An outfit it brings. */
  attire?: string;
}

export interface Fate {
  heart: DaoId;
  label: string;
  line: string;
}

export interface HallBook {
  dao: GreatDaoId;
  title: string;
  hanzi: string;
  /** The realm the book asks of her as it opens (an overall level index). */
  level: number;
  /** Who teaches her this year: the hall's master (and, for the sealed Hall of the Void, the eldest master). */
  teacher: string;
  beats: Beat[];
  /** The teacher's lectures, between the beats. */
  lectures: string[];
  /** What each roommate has to say this year, between the beats. */
  roommates: Partial<Record<RoommateKey, string[]>>;
  boss: { intro: string; words: [string, string][]; fates: Fate[]; victory: string };
}

const feed = (by: number) => (g: GameState) => shift(g, CULT.demon, by);
const quiet = (by: number) => (g: GameState) => shift(g, CULT.demon, -by);

export const HALL_BOOKS: HallBook[] = [
  // ------------------------------------------------------------------------------------------------ I · water
  {
    dao: "water",
    title: "Ten Thousand at the Gate",
    hanzi: "万人叩门",
    level: 2,
    teacher: "wd-hm-water",
    beats: [
      {
        step: 0,
        npc: "wd-herald",
        title: "The Herald of the Ten Halls",
        objective: "A herald on Willow Creek's market road is crying the Grand Selection of the Sect of Ten Thousand Daos. Hear him out.",
        lines: [
          ["wd-herald", "Hear ye! Once in six years the Sect of Ten Thousand Daos opens its east gate! Any soul under thirty, of any sect or none, may sit the Grand Selection. Ten thousand come. One hundred stay!"],
          ["wd-herald", "Ten halls, one for each Great Dao of heaven and earth, and masters who teach them from the inside. Leave your own sect's robe at the gate. Inside, every hopeful stands on equal footing."],
        ],
        after: [["wd-herald", "The gate opens at dawn and stays open until the hundred are chosen. West of the Great South Road, below the plum hills. You cannot miss it. Follow the crowd."]],
        done: "He presses a bamboo slip into her hand with a number scrawled on it: 9,847.",
      },
      {
        step: 1,
        npc: "wd-yanshu",
        title: "The Gate of Equal Footing",
        objective: "Join the ten thousand hopefuls outside the east gate of the Ten Halls, west of the Great South Road, and register with the Examiner.",
        lines: [
          ["narr", "The field outside the east gate is a sea of people: farm boys with their hoes, small-sect disciples in borrowed robes, a fisher girl with her net still over her shoulder, an old man who swears he is twenty-nine. The queue moves one hopeful at a time."],
          ["wd-yanshu", "Number? …Nine thousand eight hundred and forty-seven. Name, home, sect if any. Then step through the Gate of Equal Footing."],
          ["wd-yanshu", "The gate seals whatever cultivation you carry until the Selection ends. Qi Condensation or Nascent Soul, inside you are a mortal with two legs and a heart. We are choosing hearts."],
          { a: "hero", n: "token" },
          ["narr", "As she steps through, her qi goes quiet, like a lamp turned down to a bead. She feels very small, and very light."],
        ],
        choice: {
          prompt: "A boy no older than twelve ducks under the rope and slips into the queue ahead of you.",
          options: [
            { heart: "mercy", label: "Let him stay ahead of you", then: "She steps back half a pace to make room. The boy stares at her, then grins with two teeth missing.", reply: ["wd-qiu", "…Thanks, big sister. I'm Qiu. I'm sixteen."] },
            { heart: "sword", label: "Tell him to wait his turn", then: "She taps his shoulder and points to the back of the line. He goes, scowling, and is somehow back in front of her within the hour.", reply: ["wd-qiu", "You again! Fine. I'm Qiu. I'm sixteen. Don't laugh."] },
            { heart: "balance", label: "Say nothing, and watch him", then: "She lets it be, and watches. His sandals are worn right through. He has walked a very long way.", reply: ["wd-qiu", "What are you looking at? I'm Qiu. I'm sixteen."] },
            { heart: "slaughter", label: "Haul him out by the collar", then: "She lifts him out of the line by the collar. The crowd laughs. The boy does not.", reply: ["wd-qiu", "…I walked forty days to get here. Forty."], effect: feed(2) },
          ],
        },
        after: [["wd-yanshu", "Nine thousand eight hundred and forty-seven, through. On to the stair. And you, boy: sixteen, indeed. Through."]],
        done: "Ten thousand hopefuls pass the Gate of Equal Footing, and ten thousand cultivations go quiet together.",
      },
      {
        step: 2,
        npc: "wdf-tieniu",
        title: "The Stair of Asking Heart",
        objective: "Climb the Stair of Asking Heart with the other hopefuls, and find the big young man carrying a boy near the top (outside the east gate).",
        lines: [
          ["narr", "The Stair of Asking Heart has nine hundred and ninety-nine steps, and every one of them weighs what you are carrying in your heart. Halfway up, people begin to sit down and weep and go home."],
          ["narr", "Near the top, a huge young man is carrying the boy Qiu on his back. Qiu fainted on the six hundredth step. The big man's legs are shaking."],
          ["wd-tieniu", "I'm Tie Niu. My father carries salt for a living. I can carry one boy. I'm not sure I can carry one boy and whatever's in my heart as well."],
          { a: "hero", n: "climb" },
        ],
        choice: {
          prompt: "Tie Niu is about to fall.",
          options: [
            { heart: "mercy", label: "Take Qiu on your own back", then: "She takes the boy. The stair gets heavier by exactly one boy and a stranger's kindness, and somehow that is lighter than before.", reply: ["wd-tieniu", "You're stronger than you look. Or kinder. On this stair it's the same thing."] },
            { heart: "balance", label: "Take turns, step for step", then: "They pass the boy between them, step for step. Neither carries more than a share.", reply: ["wd-tieniu", "That's how my father and my uncle carry the big loads. Turn and turn about."] },
            { heart: "sword", label: "Climb ahead and clear the way", then: "She climbs ahead and helps the fallen out of their path, and Tie Niu climbs the road she makes.", reply: ["wd-tieniu", "Like a plough in front of an ox. I'm the ox. Ha!"] },
            { heart: "slaughter", label: "Leave them: only a hundred are taken", then: "She climbs on alone. At the top she looks back. Tie Niu is still coming, one step at a time, with the boy.", reply: ["wd-tieniu", "…We made it anyway. No thanks to you."], effect: feed(2) },
          ],
        },
        after: [["narr", "At the top, Qiu wakes up and asks whether he passed. Nobody knows yet."]],
        done: "Of ten thousand, four thousand reach the top of the stair.",
      },
      {
        step: 3,
        npc: "wdf-yaozhi",
        title: "The Stone of Affinity",
        objective: "Lay your hand on the Stone of Affinity, where a young lady of Jinhe is holding court outside the east gate.",
        lines: [
          ["wd-yaozhi", "Yao Zhi, of the Golden Pavilion Yaos of Jinhe. You've heard of us. Everyone has heard of us. The stone lit up gold for me, by the way. Metal. Of course."],
          ["wd-yaozhi", "Go on, put your hand on it. If it doesn't light, don't cry on my sleeve. It's silk."],
          { a: "hero", n: "cast" },
          ["narr", "The Stone of Affinity drinks her touch, thinks about it, and blooms a slow, deep blue: water, bright as a lake at noon. Then, for one breath, at the very heart of the blue, something with no colour at all."],
          ["narr", "By the gate, Examiner Yan Shu looks up from his register, and writes something down."],
          ["wd-yaozhi", "Water. Well. Water's very… useful. What was that clear bit? I've never seen it do that."],
          ["hero", "Neither have I."],
        ],
        done: "Twelve hundred remain after the stone. The rest are thanked, given a bowl of noodles and sent home.",
      },
      {
        step: 4,
        npc: "wdf-shenbai",
        title: "The Long Run",
        objective: "Run three times round the walls of the Ten Halls before the incense burns down, and find the barefoot farm boy at the finish (outside the east gate).",
        lines: [
          ["narr", "Three times round the walls before a stick of incense burns down, with every cultivation sealed. Shen Bai, a farm boy from the riverlands, runs it barefoot with his hoe over his shoulder, because he will not leave it with strangers."],
          ["wd-shenbai", "It was my grandfather's hoe! It's — huff — it's not heavy. It's just — huff — long."],
          { a: "hero", n: "pant" },
        ],
        choice: {
          prompt: "The incense is nearly gone. Shen Bai has a stitch and is falling behind.",
          options: [
            { heart: "mercy", label: "Run back for him", then: "She doubles back and runs beside him, carrying the hoe. They cross the line as the last ash falls.", reply: ["wd-shenbai", "You came back. Nobody comes back. I'm Shen Bai. Thank you, um — Lin Yue? Lin Yue!"] },
            { heart: "balance", label: "Tell him to breathe with his steps", then: "She falls in beside him and counts breaths aloud until his feet find the count. The stitch goes.", reply: ["wd-shenbai", "Two steps in, two steps out. My grandfather ploughed like that. I'm Shen Bai!"] },
            { heart: "sword", label: "Run your own best race", then: "She runs her own race and finishes among the first. Shen Bai staggers in after her, just inside the ash.", reply: ["wd-shenbai", "You run like a hare! I run like a turnip. I'm Shen Bai."] },
            { heart: "slaughter", label: "Trip the boy about to shove him aside", then: "A tall boy is about to shoulder Shen Bai off the path. She hooks his foot. He goes down; Shen Bai goes through.", reply: ["wd-shenbai", "Did you trip him for me? I… thank you? I'm Shen Bai."], effect: feed(2) },
          ],
        },
        done: "Three hundred remain after the run.",
      },
      {
        step: 5,
        npc: "wdf-murong",
        title: "The Ring of Three Hundred",
        objective: "Stand in the ring outside the east gate with the last three hundred, and stay in it longer than the young master Murong Xiao.",
        lines: [
          ["narr", "Three hundred hopefuls in one ring, cultivation sealed, no weapons. Whoever is thrown out is out, and the ring shrinks with every bell."],
          ["wd-murong", "Murong Xiao, of the Murong clan of the north. I don't need to say anything else. Stand aside, mud, or be thrown aside."],
          ["narr", "Three bells from the end he bears down on a slight girl with ink on her fingers, who has not thrown anyone all day and has not been thrown either."],
          { a: "hero", n: "spar" },
        ],
        choice: {
          prompt: "Murong Xiao lunges for the ink-fingered girl.",
          options: [
            { heart: "sword", label: "Step in and meet him", then: "She steps into his path. His throw meets nothing; she has turned, and he has to dance to stay inside the line.", reply: ["wd-murong", "…Who are you? Remember my name. You'll hear it again."] },
            { heart: "mercy", label: "Pull the girl clear", then: "She catches the girl's sleeve and pulls her aside. Murong goes stumbling past and only just stops at the rope.", reply: ["wd-meilan", "Thank you. I'm Mei Lan. I was writing down how everyone fights, and I forgot to fight."] },
            { heart: "balance", label: "Let his own weight do it", then: "She does nothing until the last moment, then turns her hip. His lunge carries him to the rope and over it, and the judges call him back in only because the bell had already rung.", reply: ["wd-murong", "A trick! You — fine. Fine! We will meet again."] },
            { heart: "slaughter", label: "Throw him out, hard", then: "She throws Murong Xiao out of the ring so hard he rolls three times. The crowd goes quiet.", reply: ["wd-murong", "You'll regret that. My clan has a long memory, mud."], effect: feed(3) },
          ],
        },
        done: "When the last bell rings, one hundred and twelve are still standing in the ring, and she is one of them.",
      },
      {
        step: 6,
        npc: "wd-hm-water",
        title: "The Final Question",
        objective: "Answer Hall Master Lan Yi's final question, in the square of the Ten Halls.",
        lines: [
          ["wd-hm-water", "I am Lan Yi, master of the Hall of Still Water. One hundred and twelve of you, and room for a hundred. Every six years I ask the same question, and every six years the answer I want is different."],
          ["wd-hm-water", "What is the Dao of Water?"],
        ],
        choice: {
          prompt: "What is the Dao of Water?",
          options: [
            { heart: "balance", label: "“It finds the low place, and is never lost there.”", then: "She says water goes down, and down, and fills the low place, and then it is level with the world.", reply: ["wd-hm-water", "That is the book's answer, and the book is right. Pass."] },
            { heart: "mercy", label: "“It gives itself to everything, and asks nothing back.”", then: "She says the fields drink it and the fish swim in it and the thirsty kneel to it, and it never sends a bill.", reply: ["wd-hm-water", "Ha. Never sends a bill. Pass."] },
            { heart: "sword", label: "“It cuts canyons, given time.”", then: "She says that water is patient, and the patient win.", reply: ["wd-hm-water", "Patient violence. Not the answer I wanted, and true. Pass."] },
            { heart: "slaughter", label: "“A flood.”", then: "She says one word.", reply: ["wd-hm-water", "…Floods are water too. I will be watching you, girl. Pass."], effect: feed(2) },
          ],
        },
        after: [["narr", "Twelve are sent home with honour and a bowl of noodles. Little Qiu is not among them. He is crying so hard with relief that Tie Niu has to hold him up."]],
        done: "The hundred are chosen.",
      },
      {
        step: 7,
        npc: "wd-gou",
        title: "Room Seven",
        objective: "Report to Steward Gou outside the Outer Court dormitories, in the south-west of the Ten Halls, for your robe, your token and your bunk.",
        lines: [
          ["wd-gou", "Name? Lin Yue. Outer disciple, first year. Here's your robe. Here's your token: don't lose it. It opens the gate, the dining hall and the latrine, in that order of importance."],
          { a: "hero", n: "twirl" },
          ["wd-gou", "East row, Room Seven. Six bunks, six of you. Curfew bell at the second watch. Hot water before dawn, if you're quick. Chores from me, missions from Senior Sister Fan Yu, lectures from your Hall."],
          ["wd-gou", "And if the world's troubles call you away (I hear you have a few), go. Outer disciples may take leave. I'll mark your bunk 'away', and nobody touches it."],
          ["wd-gou", "Room Seven. Hm. Of all the rooms. Off you go."],
        ],
        done: "The gate's seal lifts from her as she takes the token, and her qi comes back into her like the tide coming in.",
        attire: "outerrobe",
      },
      {
        step: 8,
        npc: "wd-meilan",
        title: "Six Bunks",
        objective: "Step into Room Seven of the Outer Court dormitory and meet the five you will share it with.",
        lines: [
          ["narr", "Room Seven is six bunks, one table, one lamp and a window that does not quite shut. Five faces turn to the door."],
          ["wd-shenbai", "Lin Yue! I saved you the bunk by the window. It's the coldest. Sorry. It was the only one left."],
          ["wd-yaozhi", "I asked for a room of my own. They laughed. Laughed! Well. At least you don't snore. Do you snore?"],
          ["wd-tieniu", "I brought dumplings down from the stair. They got squashed. They're still dumplings."],
          ["wd-qiu", "I'm sixteen."],
          ["narr", "Everyone: “We know.”"],
          ["wd-meilan", "Mei Lan. I wrote down everything that happened at the Selection. You should look under your bunk."],
          { a: "hero", n: "look" },
          ["narr", "Carved small into the underside of the window bunk, worn almost smooth: 清雪, Clear Snow. And beside it, in another hand: “Lian Qingxue slept here one winter and snored. — her roommate.”"],
          ["hero", "…The founder of the Azure Cloud slept in this bunk."],
          ["wd-meilan", "A thousand years ago. Room Seven has had famous people in it. And people who went home."],
        ],
        done: "Six bunks, six of them. Room Seven is full again.",
      },
      {
        step: 9,
        npc: "wd-qiu",
        title: "The First Night",
        objective: "The curfew bell has rung, and Little Qiu is crying quietly in his bunk in Room Seven. Talk to him.",
        lines: [
          ["wd-qiu", "I'm not crying. I'm… I'm twelve. Don't tell. Please."],
          ["wd-qiu", "My brother Qiu Feng passed the Selection six years ago. He wrote every month for a year. Then the sect sent a letter: 'Outer disciple Qiu Feng has gone home.' He never came home."],
          ["wd-qiu", "Steward Gou said every Selection somebody 'goes home'. He said it like a joke that isn't funny."],
        ],
        choice: {
          prompt: "Little Qiu is waiting for you to say something.",
          options: [
            { heart: "mercy", label: "“I'll help you find him.”", then: "She promises. Qiu holds her sleeve until he falls asleep.", reply: ["wd-qiu", "…Promise promise?"], effect: quiet(2) },
            { heart: "balance", label: "“First, we find out what is true.”", then: "She tells him they will find out what really happened before they decide anything.", reply: ["wd-qiu", "Mei Lan said that too. She writes everything down. Maybe she can write down where he went."] },
            { heart: "sword", label: "“Then we make them tell us.”", then: "She tells him that if the sect is hiding something, she will drag it out.", reply: ["wd-qiu", "Yes! …Tomorrow. After breakfast. I'm hungry."] },
            { heart: "slaughter", label: "“Keep quiet, or they'll send you home too.”", then: "She tells him to stop crying before someone hears.", reply: ["wd-qiu", "…You think he's dead. Don't you."], effect: feed(1) },
          ],
        },
        after: [["narr", "Across the room, Mei Lan's brush is still moving in the dark."]],
        done: "Room Seven sleeps. Nearly all of it.",
      },
      {
        step: 10,
        npc: "wd-fanyu",
        title: "The Mission Hall",
        objective: "Collect your first mission from Senior Sister Fan Yu at the Mission Hall's board in the square.",
        lines: [
          ["wd-fanyu", "First years. Every one of you thinks the Mission Hall is adventure. It's errands. Letters, herbs, sparring partners, sweeping. Each one earns contribution, and contribution buys lectures, pills and the right to complain."],
          ["wd-fanyu", "Your hall this year is Still Water, under Master Lan Yi. Her lectures, my missions, Steward Gou's chores, and whatever your roommates drag you into. Don't fall behind."],
          ["wd-fanyu", "One more thing. If anyone in your row 'goes home' in the night, you tell me first. Not the Examiner. Me."],
        ],
        done: "The board is covered in slips. She takes the first one.",
      },
      {
        step: 20,
        npc: "wd-gou",
        title: "The Rules of the Row",
        objective: "Steward Gou wants a word with Room Seven, outside the dormitories.",
        lines: [
          ["wd-gou", "Room Seven. The founder's bunk, they say, though I've never seen her name in my register. I've seen others."],
          ["wd-gou", "Six years ago Room Seven had a boy in it called Qiu Feng. Good boy. Snored. Went home in the spring, says the register. His was the bunk your little friend sleeps in now. I didn't tell the little one. I'm telling you."],
        ],
        choice: {
          prompt: "What do you do with what Steward Gou told you?",
          options: [
            { heart: "mercy", label: "Tell Qiu tonight, gently", then: "She tells Qiu that night. He sleeps with his hand flat on the underside of the bunk above him, as if it might still be warm.", reply: ["wd-gou", "…Good. Somebody should have told me, once."] },
            { heart: "balance", label: "Keep it until you know more", then: "She keeps it to herself, and starts counting the bunks in every room of the row.", reply: ["wd-gou", "Patient. Lan Yi will like you."] },
            { heart: "sword", label: "Ask who signed the register", then: "She asks who writes 'went home' in the register.", reply: ["wd-gou", "The Examiner signs every one. Yan Shu. Lovely handwriting. You didn't hear it from me."] },
            { heart: "slaughter", label: "Demand to see the register", then: "She tells him to hand it over. He looks at her a long time and does not.", reply: ["wd-gou", "Forty years a steward, girl. Shouting won't open a drawer."], effect: feed(1) },
          ],
        },
        done: "Somewhere in the row, someone has started counting.",
      },
      {
        step: 30,
        npc: "wd-hm-water",
        title: "Lan Yi's First Lecture",
        objective: "Hall Master Lan Yi is lecturing outside the Hall of Still Water. Attend.",
        lines: [
          ["wd-hm-water", "Pour your tea onto the flagstones. All of it. Now watch where it goes."],
          { a: "hero", n: "bucket" },
          ["narr", "The tea runs between the stones, finds the one crack lower than the rest, and is gone into it, every drop."],
          ["wd-hm-water", "Whatever is lost in this court ends up in its low places. Remember that, when something goes missing."],
          ["wd-hm-water", "And one more thing, Lin Yue. The stone showed something in you that it almost never shows. Do not tell anyone. Not your roommates. Not the Examiner."],
        ],
        done: "The low place, where everything goes. She will remember.",
      },
      {
        step: 40,
        npc: "wd-shenbai",
        title: "The Missing Pill",
        objective: "Shen Bai has been accused of stealing in Room Seven. Hear him out.",
        lines: [
          ["wd-shenbai", "Murong Xiao says I stole his Cleansing Pill. They found the box under my bunk. Empty. I didn't! I'd never even seen a pill before I came here!"],
          ["wd-shenbai", "If it isn't found by the end of the month, I'm sent home. Grandfather sold the ox to pay for my road here."],
        ],
        choice: {
          prompt: "How do you start?",
          options: [
            { heart: "mercy", label: "Sit with him first", then: "She sits with him until he stops shaking, and then they begin.", reply: ["wd-shenbai", "…Thank you. All right. All right. Where do we start?"] },
            { heart: "balance", label: "“Think like water. Where would a thing go?”", then: "She remembers Lan Yi's tea, and the crack it ran into.", reply: ["wd-shenbai", "The low place? There's a drain under the north row. Everything ends up in it. My sandal did."] },
            { heart: "sword", label: "Go and face Murong", then: "She walks straight to Murong Xiao and tells him to his face that Shen Bai is no thief.", reply: ["wd-shenbai", "You said that to Murong? To his face? Oh no. Oh, that's wonderful. Oh no."] },
            { heart: "slaughter", label: "Turn Murong's room over yourself", then: "She turns Murong's room upside down. There is no pill in it, and now there is a complaint against her too.", reply: ["wd-shenbai", "Now they're angry at both of us. That's… fair, I suppose."], effect: feed(2) },
          ],
        },
        done: "The month has begun to run out.",
      },
      {
        step: 60,
        npc: "wd-murong",
        title: "Where Water Goes",
        objective: "The pill was in the drain under the north row, where Murong's hanger-on Hou Er threw it. Take it to Murong Xiao, by the ring.",
        lines: [
          ["narr", "In the drain under the north row, wrapped in a sock, is a Cleansing Pill with the Murong crest stamped on it. Hou Er, who sleeps above the drain and carries Murong's bags, threw it there to make his master grateful."],
          ["wd-murong", "…Hou Er did this? For me? I never asked him to. I never asked anyone to. People do things for the name, not for me."],
        ],
        choice: {
          prompt: "Murong Xiao is holding the pill and looking at nothing.",
          options: [
            { heart: "balance", label: "“Clear Shen Bai's name, and we're even.”", then: "She asks only that he tell the Steward the truth.", reply: ["wd-murong", "Even. Yes. I'll tell Gou. And Hou Er can carry his own bags."] },
            { heart: "mercy", label: "“Hou Er was afraid of you. Ask him why.”", then: "She tells him to find out why a boy would do such a thing for him.", reply: ["wd-murong", "…Afraid. Of me. I'll ask him. I don't think I'll like the answer."] },
            { heart: "sword", label: "“Apologise to Shen Bai, in front of the row.”", then: "She tells him an apology made in private is worth nothing.", reply: ["wd-murong", "In front of — fine. Tomorrow, at breakfast. Don't watch."] },
            { heart: "slaughter", label: "Make him eat the sock", then: "She suggests, sweetly, that he put the sock in his mouth until he has thought about it.", reply: ["wd-murong", "…You are a terrible person, Lin Yue. I'll clear his name anyway."], effect: feed(2) },
          ],
        },
        done: "Shen Bai's name is cleared at breakfast. He cries into his porridge, and nobody laughs.",
      },
      {
        step: 70,
        npc: "wd-yaozhi",
        title: "Golden Thread",
        objective: "Yao Zhi has something to say to you in Room Seven, and is pretending she doesn't.",
        lines: [
          ["wd-yaozhi", "You did a decent thing for the turnip boy. Shen Bai. Fine, Shen Bai. I watched you."],
          ["wd-yaozhi", "Since we are being decent: my family sent me here to be seen by the Murongs. I'm to marry Murong Xiao in a year or two. I sat the Selection so I could be somewhere they can't send letters every day."],
          ["wd-yaozhi", "And you're Azure Cloud. Don't look like that. Your stance gives it away. Whatever you're doing here, you didn't come for a husband either."],
        ],
        choice: {
          prompt: "Yao Zhi is waiting to see what you will say.",
          options: [
            { heart: "mercy", label: "“Then this room is yours too.”", then: "She tells Yao Zhi that Room Seven doesn't send letters, and doesn't arrange marriages.", reply: ["wd-yaozhi", "…Don't be kind at me. I don't know what to do with it."] },
            { heart: "balance", label: "“We're both looking for something.”", then: "She tells her the truth: she came to learn the Daos from the inside.", reply: ["wd-yaozhi", "From the inside. Hm. That's a better reason than mine."] },
            { heart: "sword", label: "“Then refuse him.”", then: "She tells her to say no, to his face, and to her family's.", reply: ["wd-yaozhi", "Easy for you to say. …Easier for you. Maybe one day for me."] },
            { heart: "slaughter", label: "“Marry him and take the clan.”", then: "She says the Murongs would make a fine purse.", reply: ["wd-yaozhi", "Ha! My father would adore you. I don't, quite."] },
          ],
        },
        done: "Yao Zhi lends her a silk pillowcase, which in the Golden Pavilion is apparently a declaration of friendship.",
      },
      {
        step: 80,
        npc: "wd-qiu",
        title: "A Name Under the Bunk",
        objective: "Little Qiu has found something under his bunk in Room Seven.",
        lines: [
          ["wd-qiu", "Look. Under the slats. My brother's writing. I'd know it anywhere; it leans like it's running."],
          ["narr", "Scratched into the wood with a hairpin: 'QIU FENG. Room Seven. Lights in the closed hall again. Third time.'"],
          ["wd-qiu", "The closed hall. That's the Void one, at the corner, with the chains. Nobody goes in. Nobody's allowed."],
        ],
        choice: {
          prompt: "Qiu wants to go and look at the Sealed Hall tonight.",
          options: [
            { heart: "balance", label: "“Not tonight. We watch first.”", then: "She makes him promise to wait until they know when the lights come.", reply: ["wd-qiu", "…Fine. But I'm writing it down like Mei Lan does."] },
            { heart: "mercy", label: "Sit up with him instead", then: "She sits up with him and talks about his brother until he falls asleep mid-sentence.", reply: ["wd-qiu", "He used to sing badly. On purpose. To make me laugh."] },
            { heart: "sword", label: "“We go together, when it's time.”", then: "She promises that when they go, she goes first.", reply: ["wd-qiu", "First. You promised first."] },
            { heart: "slaughter", label: "Scrape the words off before anyone sees", then: "She scrapes the words away with her knife. Qiu watches without a word.", reply: ["wd-qiu", "…That was all I had of him."], effect: feed(2) },
          ],
        },
        done: "Lights in the closed hall. Third time. Room Seven has its first clue.",
      },
      {
        step: 90,
        npc: "wd-fanyu",
        title: "The Outer Court Tournament",
        objective: "Senior Sister Fan Yu has the tournament lists at the Mission Hall's board.",
        lines: [
          ["wd-fanyu", "End of the first season: the Outer Court Tournament. Cultivation unsealed this time, so try not to kill anyone."],
          ["wd-fanyu", "Murong Xiao has entered, and named you as the one he wants in the final. Very dramatic. The whole court is talking about it."],
          ["wd-fanyu", "Win or lose, the Hall of Still Water will have its eye on you. And so, I think, will the Examiner. He asked for your file this morning."],
        ],
        done: "Her name is on the board beside Murong Xiao's, in the Examiner's lovely handwriting.",
      },
      {
        step: 98,
        npc: "wd-hm-water",
        title: "Win Like Water",
        objective: "Hall Master Lan Yi wants a word before the final, outside the Hall of Still Water.",
        lines: [
          ["wd-hm-water", "He will come at you like a wave on a rock. Do not be the rock. Be what the wave is made of."],
          ["wd-hm-water", "And Lin Yue: win it cleanly. People are watching who should not be."],
        ],
        done: "The ring is ready. Murong Xiao is waiting in it.",
      },
    ],
    lectures: [
      "Water does not argue with the stone. It goes round, and in a thousand years there is no stone.",
      "Fill a cup and it is a cup's shape. Pour it out and it is the floor's. Water has no face of its own, and so it is never insulted.",
      "Still water shows the moon. Stir it, and you see only yourself. That is the whole of meditation.",
      "The sea is great because it lies lower than every river. Be lower than your pride, girl.",
      "Ice, mist, rain, tea: one water. Be many things, and stay one thing.",
      "A flood is water that forgot it was patient.",
    ],
    roommates: {
      "wd-shenbai": ["Grandfather says rain is the sky paying back what the fields lent it. I wrote him that I eat meat twice a week here. He won't believe it.", "I've started getting up before Steward Gou, so I get hot water. It's the best part of being a cultivator so far."],
      "wd-yaozhi": ["The dining hall's tea is a crime. I've written to Jinhe for proper leaves. I'll share. Don't tell anyone I share.", "Murong keeps looking over at our table. I keep looking at the ceiling. It's a very interesting ceiling."],
      "wd-tieniu": ["My father says a load is easy if you love the person you're carrying it for. I'm carrying Qiu's laundry. He doesn't know.", "I can eat three bowls of rice now instead of five. I think it's the qi. Or the rice is bigger."],
      "wd-meilan": ["I write down everything. If you write things down, nobody can tell you later that they didn't happen.", "There are a hundred of us this year. Last Selection there were a hundred too. Ninety-nine finished their first year."],
      "wd-qiu": ["I'm sixteen. …I'm practising saying it so it sounds true.", "Tie Niu snores like an ox and Shen Bai talks to his hoe in his sleep. Best room in the row."],
    },
    boss: {
      intro: "Murong Xiao steps into the ring, bows exactly as low as he must and not a hair lower, and draws.",
      words: [
        ["wd-murong", "Cultivation unsealed. No more tricks of the hip, Azure Cloud. Let's see what the stone really saw in you."],
      ],
      fates: [
        { heart: "mercy", label: "Offer him your hand", line: "She holds out her hand. Murong Xiao looks at it for a long time, and then takes it, and lets her pull him up in front of the whole court." },
        { heart: "sword", label: "Bow, and walk away", line: "She bows the exact depth he bowed to her, and not a hair lower, and walks out of the ring. He laughs, despite himself." },
        { heart: "balance", label: "Tell him why he lost", line: "She tells him quietly that he fights to win his clan's name, and she fights to win the bout, and that the bout is easier to carry. He listens. He hates it. He remembers it." },
        { heart: "slaughter", label: "Stand on his sleeve until he yields aloud", line: "She stands on his sleeve until he says “I yield” loud enough for the back row. Nobody cheers for a long moment." },
      ],
      victory: "The Outer Court roars. Lan Yi nods once from the steps of the Hall of Still Water. Somewhere in the crowd Little Qiu is standing on Tie Niu's shoulders, screaming.",
    },
  },
  // ------------------------------------------------------------------------------------------------ II · wood
  {
    dao: "wood",
    title: "The Old Pine's Garden",
    hanzi: "古松园",
    level: 4,
    teacher: "wd-hm-wood",
    beats: [
      {
        step: 0,
        npc: "wd-hm-wood",
        title: "The Old Pine",
        objective: "Your second year belongs to the Hall of the Old Pine. Report to Hall Master Gu Song in its garden.",
        lines: [
          ["wd-hm-wood", "Ah. The water girl. Lan Yi says you won with your hips. Good. Wood is not so different: a tree wins by not falling over for four hundred years. I would know."],
          ["wd-hm-wood", "My garden is sick. Look at the wisteria's roots. Black. Not rot, not beetle. Something is drinking it from below."],
          { a: "wd-hm-wood", n: "point" },
        ],
        done: "Since morning a whole bed of spirit herbs in the Old Pine's garden has gone grey.",
      },
      {
        step: 10,
        npc: "wd-shenbai",
        title: "Farmer's Eyes",
        objective: "Shen Bai has had his hands in the Old Pine's soil. Ask him what he found, in Room Seven.",
        lines: [
          ["wd-shenbai", "I put my hand in the soil by the wisteria. It's dust three feet down, and damp on top. Soil doesn't do that. Something's pulling the water out from underneath, like a straw in a bowl."],
        ],
        choice: {
          prompt: "Shen Bai wants to know what to do.",
          options: [
            { heart: "balance", label: "Tell Gu Song exactly what he found", then: "She takes Shen Bai to Gu Song and makes him say it himself.", reply: ["wd-shenbai", "He listened to me! A Hall Master listened to me! He called me 'young farmer'!"] },
            { heart: "sword", label: "Dig down tonight and see", then: "They dig after curfew until Steward Gou's lantern comes round the corner.", reply: ["wd-shenbai", "Four feet and nothing but dust. And blisters. And Gou."] },
            { heart: "mercy", label: "Water the wisteria by hand meanwhile", then: "She and Shen Bai carry water to the wisteria every dawn. It does not help much. It helps a little.", reply: ["wd-shenbai", "It drinks like it's dying of thirst. Because it is."] },
            { heart: "slaughter", label: "Pour fire-salt on the roots and see what flees", then: "She pours fire-salt on the roots. Something below the earth goes still. So does the wisteria.", reply: ["wd-shenbai", "Lin Yue! It's a living thing!"], effect: feed(2) },
          ],
        },
        done: "Something is drinking the garden from underneath.",
      },
      {
        step: 20,
        npc: "wd-hm-wood",
        title: "A Seedling of Your Own",
        objective: "Gu Song has something to give you in the Old Pine's garden.",
        lines: [
          ["wd-hm-wood", "Every disciple of the Old Pine raises one tree. Here is yours. It will outlive you, if you are any good."],
          { a: "hero", n: "plant" },
          ["wd-hm-wood", "Growing is not getting bigger, girl. Growing is not stopping. Water it, and come back."],
        ],
        done: "Her seedling stands in its row between Shen Bai's and Tie Niu's. Tie Niu has already named his.",
      },
      {
        step: 30,
        npc: "wd-yaozhi",
        title: "A Letter from Jinhe",
        objective: "A letter has come for Yao Zhi in Room Seven, and she has thrown it at the wall.",
        lines: [
          ["wd-yaozhi", "The Murongs have fixed the day. Autumn, next year. My father says it's an honour. My father says lots of things."],
          ["wd-yaozhi", "I could run. I could fail every lecture until they send me home. I could marry Murong and poison his tea. Help me choose."],
        ],
        choice: {
          prompt: "Yao Zhi is serious, mostly.",
          options: [
            { heart: "mercy", label: "“Write and tell them how you feel.”", then: "She helps Yao Zhi write it: plain words, no Golden Pavilion flourishes.", reply: ["wd-yaozhi", "It's the shortest letter I've ever written. It's terrifying."] },
            { heart: "balance", label: "“A year is long. Grow first.”", then: "She points out that a year is a long time in a garden.", reply: ["wd-yaozhi", "Gu Song said the same about my seedling. You're both insufferable."] },
            { heart: "sword", label: "“Tell the Murongs no yourself.”", then: "She tells her the word is short and she is perfectly able to say it.", reply: ["wd-yaozhi", "To their faces? …One day. Not today. Soon."] },
            { heart: "slaughter", label: "“The tea, then.”", then: "She says nothing, and looks meaningfully at the teapot.", reply: ["wd-yaozhi", "…I was joking. You weren't. Were you?"] },
          ],
        },
        done: "Yao Zhi's letter goes south to Jinhe. The reply will take a long time.",
      },
      {
        step: 40,
        npc: "wd-meilan",
        title: "The Line of Black Roots",
        objective: "Mei Lan has drawn a map in Room Seven, and wants you to see it.",
        lines: [
          ["wd-meilan", "I marked every dead plant in the court on this map. Look. It isn't scattered. It's a line."],
          ["narr", "A line of small black ink dots runs from the Old Pine's wisteria, under the square, under the dormitories, straight to the corner of the court where the Sealed Hall of the Void stands in its chains."],
        ],
        choice: {
          prompt: "What do you do with Mei Lan's map?",
          options: [
            { heart: "balance", label: "Show Gu Song", then: "She takes the map to Gu Song. He looks at it for a long time and says only, “Keep it safe.”", reply: ["wd-meilan", "He believed it. I could see it. He was frightened."] },
            { heart: "sword", label: "Walk the line tonight", then: "She walks the line of dots after curfew, all the way to the chains on the Sealed Hall's door. They are warm.", reply: ["wd-meilan", "Warm? Chains shouldn't be warm."] },
            { heart: "mercy", label: "Ask Mei Lan why she cares so much", then: "She asks Mei Lan what she is really looking for. Mei Lan's brush stops.", reply: ["wd-meilan", "…Someone. I'll tell you when I'm sure. I promise."] },
            { heart: "slaughter", label: "Show the Examiner, and watch his face", then: "She shows the map to Yan Shu and watches. His face does nothing at all, which is worse than anything it might have done.", reply: ["wd-meilan", "You showed HIM? Lin Yue…"], effect: feed(2) },
          ],
        },
        done: "The garden is dying in a straight line, and the line ends at the Sealed Hall.",
      },
      {
        step: 60,
        npc: "wd-hm-wood",
        title: "The Wisteria Speaks",
        objective: "Gu Song has asked you to come to the Old Pine's garden after dark.",
        lines: [
          ["narr", "At midnight Gu Song lays his old hand on the thousand-year wisteria, and it speaks through him in a voice like leaves."],
          ["wd-hm-wood", "“Something under the corner hall drinks. It has drunk for sixty winters. It drank only a little until this spring. Now it is thirsty for everything.”"],
          ["wd-hm-wood", "…This spring. The Selection. Whatever lives under the Sealed Hall woke up hungrier when you all came through the gate."],
        ],
        done: "Sixty winters of drinking, and this spring it grew thirsty.",
      },
      {
        step: 70,
        npc: "wd-tieniu",
        title: "What Tie Niu Dug Up",
        objective: "Tie Niu dug where Shen Bai told him to, and found something. Hear it in Room Seven.",
        lines: [
          ["wd-tieniu", "I dug where Shen Bai said, six feet down. There's a pipe. Jade, thick as my arm, running toward the corner hall. It hums."],
          ["wd-tieniu", "Then the Examiner came. He smiled. He said it was an old irrigation channel from the founder's time and we were to fill the hole in tonight, for our safety. He said 'for your safety' three times."],
        ],
        done: "The hole is filled in by morning. Nobody in Room Seven saw who did it.",
      },
      {
        step: 80,
        npc: "wd-qiu",
        title: "Planted by Qiu Feng",
        objective: "Little Qiu is sitting very still in Room Seven. Ask him what he found.",
        lines: [
          ["wd-qiu", "In the Old Pine's rows there's a peach tree, six years old. It has a tag. 'Planted by Qiu Feng, first year. Water me.'"],
          ["wd-qiu", "Somebody did. Six years, somebody watered it. Gu Song says it was him. He says he waters all the trees of disciples who went home. There are a lot of trees."],
        ],
        choice: {
          prompt: "Qiu is holding the tag in both hands.",
          options: [
            { heart: "mercy", label: "Help him water it every morning", then: "From then on, two of them water Qiu Feng's peach at dawn.", reply: ["wd-qiu", "He'd hate peaches. He'd hate that he planted one. That makes it better."], effect: quiet(2) },
            { heart: "balance", label: "Count the other trees", then: "She counts the trees of disciples who went home. Ten, one for every Selection since the Hall of the Void was sealed.", reply: ["wd-qiu", "Ten. Ten brothers. Somebody's."] },
            { heart: "sword", label: "Swear on the tree to find him", then: "She lays her hand on the peach and swears it.", reply: ["wd-qiu", "Trees remember things. Gu Song said. So now it's real."] },
            { heart: "slaughter", label: "“A tree won't bring him back.”", then: "She says it flatly. Qiu doesn't argue. He just goes on holding the tag.", reply: ["wd-qiu", "I know. I KNOW."], effect: feed(1) },
          ],
        },
        done: "Ten trees in the Old Pine's rows, for ten who went home.",
      },
      {
        step: 90,
        npc: "wd-hm-wood",
        title: "The Blight Wakes",
        objective: "Something has gone wrong in the Old Pine's garden. Find Gu Song.",
        lines: [
          ["wd-hm-wood", "It has drunk the wisteria dry, and a thing drunk dry goes mad. The tree spirit has turned to blight. It is eating the other trees to fill itself."],
          ["wd-hm-wood", "I am four hundred years old and it is a thousand. I cannot stop it alone. Bring your roommate with the hoe."],
        ],
        done: "Black blight crawls over the Old Pine's rows, toward the ten trees.",
      },
      {
        step: 98,
        npc: "wd-shenbai",
        title: "Hold the Garden",
        objective: "Shen Bai is already pulling on his sandals in Room Seven.",
        lines: [
          ["wd-shenbai", "I'm coming. It's a garden. I know gardens. You do the fighting; I'll dig a firebreak round the ten trees so it can't get at them."],
          { a: "wd-shenbai", n: "salute" },
        ],
        done: "Shen Bai digs a ring round the ten trees with his grandfather's hoe. The blight rears up out of the wisteria.",
      },
    ],
    lectures: [
      "A tree does not hurry and does not stop. Hurrying and stopping are both things people invented.",
      "The roots go down as far as the branches go up. Nobody admires roots. Admire them.",
      "Bamboo is hollow and the strongest thing in my garden. Empty yourself of what you think you are.",
      "Cut a tree down, and the stump sends up a shoot. Wood does not take no for an answer.",
      "Every tree here was planted by someone who never sat in its shade. That is the Dao of Wood: for the ones after.",
      "Grafting: two trees agree to become one. It hurts them both. They do it anyway.",
    ],
    roommates: {
      "wd-shenbai": ["Gu Song lets me prune! Only the dead bits. But still!", "My seedling's got four leaves. I check it every morning before hot water. I've given up hot water for a tree."],
      "wd-yaozhi": ["Gold's all very well, but you can't grow it. I think that's why my family's so frightened all the time.", "My seedling died. I planted another. Don't tell anyone that I cried about a stick."],
      "wd-tieniu": ["I named my tree Little Ox. It's very small. It'll grow.", "Gu Song lifted a stone I couldn't lift, with a root. A root! I want to learn that."],
      "wd-meilan": ["I've mapped every tree in the court. Every one has a name in Gu Song's book. Some names have a little mark beside them.", "The little marks are the ones who went home."],
      "wd-qiu": ["I water my brother's peach and then mine. Mine's a plum. It's going to be bigger.", "Feng Qi's hall has no walls! He said I can visit. He said I'm light enough to sit on his roof."],
    },
    boss: {
      intro: "The thousand-year wisteria tears itself out of the ground, and walks. It is all black stems and grey blossom, and it is starving.",
      words: [["wd-hm-wood", "Do not hate it. It was thirsty, and something stole its water. Free it if you can."]],
      fates: [
        { heart: "mercy", label: "Pour your own qi into its roots", line: "She kneels in the black earth and pours her own qi down into its roots until her hands shake. The blight sighs, and goes green at the edges, and slowly settles back into the ground." },
        { heart: "sword", label: "Cut the blight out, and only the blight", line: "One stroke, then a hundred small ones, each cutting black from green. When she is done the wisteria is half its size, and all of it is alive." },
        { heart: "balance", label: "Give its hunger back to the earth", line: "She lays her palms on the ground and lets the blight's hunger run down through her into the earth, which has been hungry before and knows how to bear it." },
        { heart: "slaughter", label: "Drink what it drank", line: "She drinks the blight's stolen life into herself. It tastes of green and of something older, something that came up the jade pipe. The wisteria crumbles to dust." },
      ],
      victory: "By dawn the Old Pine's garden is quiet. The ten trees stand inside Shen Bai's firebreak, untouched, and Qiu Feng's peach has put out one pink bud.",
    },
  },
  // ------------------------------------------------------------------------------------------------ III · wind
  {
    dao: "wind",
    title: "The Hall With No Walls",
    hanzi: "无墙之殿",
    level: 5,
    teacher: "wd-hm-wind",
    beats: [
      {
        step: 0,
        npc: "wd-hm-wind",
        title: "Find the Wind",
        objective: "Your third year belongs to the Hall With No Walls. Find Hall Master Feng Qi, if you can: his hall has no walls, and he is rarely in it.",
        lines: [
          ["wd-hm-wind", "Up here! No — here. You found me in under a day. Lan Yi took a week. Gu Song never bothered."],
          ["wd-hm-wind", "The wind is never seen, only what it moves. So I teach by moving things. Lesson one: I am going to move you. Catch!"],
          { a: "wd-hm-wind", n: "twirl" },
        ],
        done: "A gust takes the token off her belt and hangs it on the pavilion's highest eave.",
      },
      {
        step: 10,
        npc: "wd-hm-wind",
        title: "The Falling Leaf",
        objective: "Feng Qi has a lesson for you at the Hall With No Walls.",
        lines: [
          ["wd-hm-wind", "Catch that leaf without moving your feet. No, don't reach for it. Breathe out. Let the air you push move it to you."],
          { a: "hero", n: "taichi" },
          ["narr", "On the fortieth try, the leaf turns over in the air and settles on the back of her hand as if it had meant to all along."],
          ["wd-hm-wind", "There. You moved the wind and the wind moved the leaf. Nobody saw you do anything. That is the whole art."],
        ],
        done: "She caught the leaf without moving. Feng Qi gave her back her token.",
      },
      {
        step: 20,
        npc: "wd-qiu",
        title: "Found Out",
        objective: "Little Qiu has been summoned to the Hall of Discipline. He is waiting in Room Seven, white as rice.",
        lines: [
          ["wd-qiu", "The enforcers found my village register. It says I'm twelve. Thirteen now. The rule is fourteen. Hall Master Lei Ting is hearing it tomorrow."],
          ["wd-qiu", "If they send me home I can't look for Feng any more. I'll never know."],
        ],
        choice: {
          prompt: "Qiu's hearing is tomorrow.",
          options: [
            { heart: "mercy", label: "“I'll speak for you.”", then: "She tells him she will stand beside him in the Hall of Discipline.", reply: ["wd-qiu", "You'll get in trouble. …Will you really?"] },
            { heart: "balance", label: "“We tell the whole truth: your brother too.”", then: "She tells him the truth is the only thing Lei Ting cannot argue with.", reply: ["wd-qiu", "The whole truth. About Feng. About the lights. All of it?"] },
            { heart: "sword", label: "“The gate weighed your heart. Say that.”", then: "She tells him the Selection chose him, and a rule cannot unchoose him.", reply: ["wd-qiu", "The gate chose me. The gate chose me! I'll say that!"] },
            { heart: "slaughter", label: "“Then don't get caught next time.”", then: "She tells him he should have hidden it better.", reply: ["wd-qiu", "…There isn't a next time. That's the point."] },
          ],
        },
        done: "Room Seven stays up all night, rehearsing.",
      },
      {
        step: 30,
        npc: "wd-hm-thunder",
        title: "The Hearing",
        objective: "Speak at Little Qiu's hearing before Hall Master Lei Ting, at the Hall of Discipline.",
        lines: [
          ["wd-hm-thunder", "Lei Ting, of the Hall of Discipline. The rule says fourteen. The boy is thirteen. The rule is a year older than he is, and the rule wins."],
          ["wd-hm-thunder", "But you asked to speak. Speak once, and be sure."],
        ],
        choice: {
          prompt: "Lei Ting is listening.",
          options: [
            { heart: "mercy", label: "“Punish me in his place.”", then: "She offers to take whatever punishment the rule demands.", reply: ["wd-hm-thunder", "A bargain with the rule? The rule does not bargain. …But I will remember that you offered."] },
            { heart: "balance", label: "“The gate weighed him and kept him. Ask the gate.”", then: "She says the Gate of Equal Footing weighed his heart and found it enough, and the sect's own gate is older than its rule.", reply: ["wd-hm-thunder", "…The gate is older than the rule. That is true. Annoyingly true."] },
            { heart: "sword", label: "“The rule is wrong.”", then: "She says it plainly: a rule that sends a brave boy home is a bad rule.", reply: ["wd-hm-thunder", "Then change it, when you sit where I sit. Until then it is the rule."] },
            { heart: "slaughter", label: "“Expel him and I go too, and I'll tell the jianghu why.”", then: "She threatens the sect's name.", reply: ["wd-hm-thunder", "Threats. In my hall. Sit down before I strike you down."], effect: feed(2) },
          ],
        },
        done: "Lei Ting says she will consider it. Nobody has ever heard her say she will consider anything.",
      },
      {
        step: 40,
        npc: "wd-hm-wind",
        title: "The Kite-Boy",
        objective: "Feng Qi has news about Little Qiu. Find him at the Hall With No Walls.",
        lines: [
          ["wd-hm-wind", "Lei Ting can't expel my kite-boy. I've just hired one. Thirteen years old, light enough to sit on my roof. He's not a disciple, so the rule doesn't touch him. He's staff. Ha!"],
          ["wd-hm-wind", "Since you're stubborn, I'll tell you something. Every Selection night for sixty years, from my roof, I've seen a light in the Sealed Hall of the Void. Nobody is supposed to have the key. Nobody."],
        ],
        done: "Qiu stays, as Feng Qi's kite-boy. And there is a light in the Sealed Hall, every Selection night, for sixty years.",
      },
      {
        step: 60,
        npc: "wd-murong",
        title: "An Unlikely Alliance",
        objective: "Murong Xiao is waiting for you by the ring, and looks as if he has not slept.",
        lines: [
          ["wd-murong", "I need your help, and I hate it. The betrothal. I don't want to marry Yao Zhi either. She'd poison my tea within the month and she'd be right to."],
          ["wd-murong", "If I refuse, my uncle Murong Hong cuts me off. He pays for everything. He's been visiting the sect a great deal lately. Always at night, always to see the Examiner."],
        ],
        choice: {
          prompt: "Murong Xiao wants help getting out of his own betrothal.",
          options: [
            { heart: "mercy", label: "Bring him to Room Seven to talk to Yao Zhi", then: "She brings him to Room Seven. Yao Zhi and Murong Xiao talk for an hour, and agree on exactly one thing, which is that they will not marry each other.", reply: ["wd-murong", "That is the first conversation I have ever had with her where nobody threw anything."] },
            { heart: "balance", label: "“Wait. Watch your uncle.”", then: "She tells him to keep his eyes on his uncle's night visits before he does anything.", reply: ["wd-murong", "Spy on my own uncle. …Yes. I've wanted to for years."] },
            { heart: "sword", label: "“Refuse, and live without his money.”", then: "She tells him a man can live on rice.", reply: ["wd-murong", "Rice. Plain rice. …Give me a year to get used to the idea."] },
            { heart: "slaughter", label: "“Find out what your uncle is hiding and use it.”", then: "She tells him every uncle has something to hide, and something hidden is a lever.", reply: ["wd-murong", "You sound like him. That frightens me more than he does."] },
          ],
        },
        done: "Murong Xiao and Room Seven now share a secret, which is a kind of truce.",
      },
      {
        step: 70,
        npc: "wd-hm-wind",
        title: "What the Wind Carries",
        objective: "Feng Qi has another lesson for you at the Hall With No Walls.",
        lines: [
          ["wd-hm-wind", "The wind carries seeds, smoke, the smell of home. It carries everything and keeps nothing. That is why it is never tired."],
          ["wd-hm-wind", "You are carrying too much, girl. Your little friend's brother, the ten trees, the founder's bunk. Put some of it down. I'll carry it for a while. I'm the wind; I can't keep it."],
          { a: "hero", n: "stretch" },
        ],
        done: "For an afternoon on Feng Qi's roof, she carries nothing at all.",
      },
      {
        step: 80,
        npc: "wd-meilan",
        title: "Night on the Roof",
        objective: "Mei Lan has borrowed Feng Qi's spyglass. Meet her in Room Seven after curfew.",
        lines: [
          ["narr", "From the roof of the Hall With No Walls, through Feng Qi's spyglass, the Sealed Hall of the Void is a black shape in the moonlight. At the third watch, its chains slide loose by themselves."],
          ["narr", "Two figures in grey carry a third between them, limp as a sack, through the door. The chains slide back."],
          ["wd-meilan", "That was an outer disciple's robe. Grey, with the blue cuff. One of us."],
        ],
        choice: {
          prompt: "The door of the Sealed Hall has closed again.",
          options: [
            { heart: "balance", label: "Remember everything, and tell Fan Yu", then: "She makes Mei Lan write down every detail, and they take it to Senior Sister Fan Yu at dawn.", reply: ["wd-meilan", "Third watch. Two bearers. Grey robes. Chains moved by themselves. I have it all."] },
            { heart: "sword", label: "Go down after them, now", then: "She drops from the roof and runs, but by the time she reaches the corner the chains are cold and the door will not move.", reply: ["wd-meilan", "Too late. They were never going to leave it open long."] },
            { heart: "mercy", label: "Count the row, to see who is gone", then: "She goes from room to room in the dark, counting sleepers. One bunk in Room Four is empty.", reply: ["wd-meilan", "Room Four. That's Lu Ping's room."] },
            { heart: "slaughter", label: "Wait for the bearers to come out, and take one", then: "She waits on the roof until dawn with a stone in her hand. Nobody comes out.", reply: ["wd-meilan", "Nobody comes out. Nobody ever comes out."] },
          ],
        },
        done: "Two in grey carried one of the Outer Court into the Sealed Hall, and the chains closed behind them.",
      },
      {
        step: 90,
        npc: "wd-fanyu",
        title: "Gone Home",
        objective: "Senior Sister Fan Yu has the morning register at the Mission Hall. Look at it.",
        lines: [
          ["wd-fanyu", "'Outer Disciple Lu Ping, Room Four, has gone home.' Signed Yan Shu, at dawn, in his lovely hand."],
          ["wd-fanyu", "I've counted, since you all started counting. Eleven in sixty years from the east row alone. One every Selection. This year we're not even half way, and it's begun."],
          ["wd-fanyu", "Don't do anything stupid. Not yet. When you do something stupid, tell me first."],
        ],
        done: "Lu Ping went home, says the register. Lu Ping's sandals are still under his bunk.",
      },
      {
        step: 98,
        npc: "wd-hm-wind",
        title: "Catch My Shadow",
        objective: "Feng Qi is waiting for you by the Hall With No Walls.",
        lines: [
          ["wd-hm-wind", "You want to chase shadows into sealed halls. Fine. First catch mine. If you can't catch the wind's master in his own court, you can't catch anything in there."],
          { a: "wd-hm-wind", n: "acrobat" },
        ],
        done: "Feng Qi drops off his roof into the court, grinning, and waits.",
      },
    ],
    lectures: [
      "You never see the wind. You see the grass bow. Be known by what you move, not by what you are.",
      "A sail does not fight the wind. It leans. That is sailing, and most of life.",
      "Breathe in. That is the wind too. You have done it all your life without thinking. That is the trick of it.",
      "The wind is always leaving, and never sad about it. I am trying to learn that. I am four hundred years old and still trying.",
      "A kite flies because the string holds it back. Freedom needs something to push against.",
      "Stand still in a storm and let it go round you. For a moment you will not know where you end. Good.",
    ],
    roommates: {
      "wd-shenbai": ["I tried to fly a kite on Feng Qi's roof and it carried me three steps. Three! I'm a cultivator!", "The wind smells of the riverlands today. Harvest smoke. I miss it, and I don't want to go."],
      "wd-yaozhi": ["Murong Xiao and I have agreed we will not marry. It's the nicest thing he's ever said to me.", "Feng Qi called me 'Little Gold' and blew my hairpins off. I am going to murder a Hall Master."],
      "wd-tieniu": ["Feng Qi says I'm too heavy for wind. I said, the wind moves mountains, doesn't it? He said, eventually. I like eventually.", "Qiu sits on the roof all day now. I bring him rice. I put an extra egg in. Don't tell him it's from me."],
      "wd-meilan": ["Lu Ping was in my lecture row. He lent me ink once. I wrote down that he lent me ink. Now it's all I have of him.", "Third watch, every time. Whatever happens in the Sealed Hall happens at the third watch."],
      "wd-qiu": ["I'm STAFF. Staff! Lei Ting has to nod at me now.", "From Feng Qi's roof you can see the whole court. I watch the corner hall every night. I'm not scared. I'm a bit scared."],
    },
    boss: {
      intro: "Feng Qi is in front of her, then behind her, then on the wall, laughing. He moves like a draught under a door.",
      words: [["wd-hm-wind", "Don't chase me. Chase where I'm going to be!"]],
      fates: [
        { heart: "mercy", label: "Ask him to keep Qiu safe", line: "Her prize, she says, is that he keeps Little Qiu off the roof at the third watch. Feng Qi stops laughing, and promises." },
        { heart: "sword", label: "Ask him to teach you that step", line: "She asks for the step he vanished with. He teaches it to her until dark, and she trips over the wind only twice." },
        { heart: "balance", label: "Ask for nothing, and hang his hat on the eave", line: "She asks for nothing. She only flicks her fingers, and a gust takes his hat off and hangs it on his own highest eave. He laughs until he has to sit down." },
        { heart: "slaughter", label: "Demand the key to the Sealed Hall", line: "She demands the key to the Sealed Hall as her prize. “If I had it, girl, I'd have used it sixty years ago,” he says, and for once he does not smile." },
      ],
      victory: "The court saw a first-year catch the wind. By supper the story has grown so much that she caught it in a bottle.",
    },
  },
  // ------------------------------------------------------------------------------------------------ IV · fire
  {
    dao: "fire",
    title: "The Furnace That Wept",
    hanzi: "泣炉",
    level: 7,
    teacher: "wd-hm-fire",
    beats: [
      {
        step: 0,
        npc: "wd-hm-fire",
        title: "The Red Furnace",
        objective: "Your fourth year belongs to the Hall of the Red Furnace. Report to Hall Master Zhu Yan.",
        lines: [
          ["wd-hm-fire", "You're late. Fire doesn't wait. Stoke number four. Don't touch number nine; it's been hissing all week like something crying."],
          ["wd-hm-fire", "Fire keeps nothing for itself, girl. It gives its heat away until there is no fire left. Everything in this hall comes from that. Including my temper. I give that away too."],
          { a: "hero", n: "brew" },
        ],
        done: "Furnace number nine hisses in the corner of the Red Furnace, all night long.",
      },
      {
        step: 10,
        npc: "wd-tieniu",
        title: "The Burst Furnace",
        objective: "Furnace nine has burst, and Tie Niu was standing beside it. He is back in Room Seven, bandaged.",
        lines: [
          ["wd-tieniu", "I'm fine. I'm made of ox. Don't cry, Qiu. Qiu. It's only my arms. I've got two."],
          ["wd-tieniu", "It didn't just crack. It sucked all its heat inwards, all at once, like a breath, and then it burst. Fire doesn't breathe in. Fire breathes out."],
        ],
        choice: {
          prompt: "Tie Niu's arms are bound to the elbow.",
          options: [
            { heart: "mercy", label: "Feed him his supper yourself", then: "She feeds him his supper spoon by spoon. He pretends to hate it.", reply: ["wd-tieniu", "My mother did this when I had the fever. Don't tell anyone. Another spoon."], effect: quiet(1) },
            { heart: "balance", label: "Ask him exactly what he saw", then: "She makes him go over it again, slowly: the breath in, the burst.", reply: ["wd-tieniu", "Grey. Just before. The flames went grey."] },
            { heart: "sword", label: "Go and look at the furnace now", then: "She goes straight to the Red Furnace. Zhu Yan is already raking through the ashes of number nine, swearing.", reply: ["wd-tieniu", "Tell Zhu Yan I didn't touch it. I didn't, this time."] },
            { heart: "slaughter", label: "Find whoever did this", then: "She leaves without a word. Shen Bai has to run after her.", reply: ["wd-tieniu", "Lin Yue — don't. Not for me. Not like that."] },
          ],
        },
        done: "Tie Niu's arms will heal. The furnace will not.",
      },
      {
        step: 20,
        npc: "wd-hm-fire",
        title: "A Stone in the Coals",
        objective: "Zhu Yan has found something in the ashes of furnace nine.",
        lines: [
          ["wd-hm-fire", "Look. A void-stone, the size of a plum, buried in the coals. It eats heat. Shove one in a furnace and the fire starves, breathes in, and bursts."],
          ["wd-hm-fire", "Somebody put it there. In my hall. Next to my disciples."],
        ],
        done: "A void-stone in the coals of furnace nine, the size of a plum.",
      },
      {
        step: 30,
        npc: "wd-yaozhi",
        title: "The Golden Pavilion's Coal",
        objective: "Zhu Yan has said something unforgivable to Yao Zhi. Find Yao Zhi in Room Seven.",
        lines: [
          ["wd-yaozhi", "The Golden Pavilion sells the sect its coal. So Zhu Yan says my family put the stone in it. She said it in front of the whole hall. 'Ask the merchant's daughter.'"],
          ["wd-yaozhi", "My family would sell their grandmothers, but they don't burn their customers. Bad for business. …Would they?"],
        ],
        choice: {
          prompt: "Yao Zhi is furious and afraid at once.",
          options: [
            { heart: "mercy", label: "“I know you didn't. That's enough for now.”", then: "She says it simply, and stays with her.", reply: ["wd-yaozhi", "…That's enough for now. Yes. Thank you."] },
            { heart: "balance", label: "“Then we check the coal, sack by sack.”", then: "She and Yao Zhi go through the coal store sack by sack. It is all ordinary coal. The stone came from somewhere else.", reply: ["wd-yaozhi", "Ordinary. All of it. I'm going to make Zhu Yan apologise to my face."] },
            { heart: "sword", label: "Take her to face Zhu Yan", then: "She walks Yao Zhi straight back into the Red Furnace to have it out.", reply: ["wd-yaozhi", "She shouted. I shouted. Then she gave me tea. I don't understand fire people."] },
            { heart: "slaughter", label: "“Write home and ask. Ask hard.”", then: "She tells her to find out, whatever it costs her family.", reply: ["wd-yaozhi", "Ask hard. All right. I'll ask so hard they'll feel it in Jinhe."] },
          ],
        },
        done: "The coal is clean. The stone came from somewhere inside the court.",
      },
      {
        step: 40,
        npc: "wd-hm-lifedeath",
        title: "Wen Ru's Ward",
        objective: "Tie Niu's burns are being dressed at the Ward of Long Sleep. Speak with Hall Master Wen Ru.",
        lines: [
          ["wd-hm-lifedeath", "Wen Ru. I keep the Ward. Your ox will heal. He heals like a hillside after a fire."],
          ["wd-hm-lifedeath", "The stone you found? Void-stone comes from one place in this sect: the foundations of the Sealed Hall. It has been shut for sixty years. Whoever is putting its stones in our furnaces has a way in."],
        ],
        done: "Void-stone comes from the Sealed Hall's foundations, and from nowhere else.",
      },
      {
        step: 60,
        npc: "wd-yaozhi",
        title: "Pills That Taste of Someone Else",
        objective: "Yao Zhi's family has written back. She is reading it in Room Seven, very still.",
        lines: [
          ["wd-yaozhi", "My uncle answered. He didn't mean to tell me anything. He's never been clever. He boasts."],
          ["wd-yaozhi", "He buys 'Essence Pills' from a Murong agent. Very dear. One a month, and he feels twenty years younger. He says they taste strange: like someone else's breath."],
          ["wd-yaozhi", "Someone else's breath, Lin Yue."],
        ],
        done: "Essence Pills, from a Murong agent, that taste of someone else's breath.",
      },
      {
        step: 70,
        npc: "wd-hm-fire",
        title: "Fire Gives",
        objective: "Zhu Yan wants to brew a pill for Tie Niu, and needs a second pair of hands at the Red Furnace.",
        lines: [
          ["wd-hm-fire", "Hands on the furnace. Not too close. Give it your heat; don't make it take. Fire that has to take goes grey. You've seen it."],
          { a: "hero", n: "brew" },
          ["narr", "They brew all night. At dawn the furnace gives up one small pill, warm as a hand, smelling of ginger and cinnamon."],
          ["wd-hm-fire", "For your ox. Tell him it's from you. I don't do kindness. I do alchemy."],
        ],
        done: "A pill warm as a hand, for Tie Niu.",
      },
      {
        step: 80,
        npc: "wd-shenbai",
        title: "Vigil",
        objective: "Shen Bai has not slept for three nights. Find him in Room Seven.",
        lines: [
          ["wd-shenbai", "He woke up! Tie Niu woke up properly and the first thing he said was 'dumplings'. The second thing was 'is Qiu all right'. The third was 'dumplings' again."],
          ["wd-shenbai", "I'm going to sleep for a week. Wake me if anything's on fire. Wake me if anything's not on fire too, actually, that'd be nice."],
        ],
        done: "Tie Niu is himself again, and eating for three.",
      },
      {
        step: 90,
        npc: "wd-hm-fire",
        title: "The Furnace Weeps",
        objective: "Something is wrong at the Red Furnace. Zhu Yan is shouting for you.",
        lines: [
          ["wd-hm-fire", "The spirit of the Great Furnace has been fed void-stones for a season, a few at a time, and now it's starving and it's crying and it's going to burst, and when it does it takes the hall and everyone in it."],
          ["wd-hm-fire", "I can't put it out. Fire like that doesn't go out. It has to be answered."],
        ],
        done: "The Great Furnace's spirit weeps grey fire in the middle of the Red Furnace.",
      },
      {
        step: 98,
        npc: "wd-tieniu",
        title: "Ox Again",
        objective: "Tie Niu is up, in Room Seven, and won't lie down.",
        lines: [
          ["wd-tieniu", "My arms are fine. Look. Mostly fine. I'm coming. I'll stand in the door and carry out anyone who falls. That's what I'm for."],
          { a: "wd-tieniu", n: "carry" },
        ],
        done: "Tie Niu stands in the Red Furnace's door. The furnace spirit turns its grey face toward her.",
      },
    ],
    lectures: [
      "Fire cooks the rice and burns the house. Same fire. Everything is in where you put it.",
      "You cannot keep fire. You can only keep feeding it. Friendship is the same. So is study.",
      "A spark is nothing. Put it in dry grass and it is a forest fire. Small things are not small.",
      "Look how fire reaches up. Always up. Even dying, it reaches up.",
      "A lamp lights another lamp and loses nothing. That is why I teach.",
      "The phoenix burns and comes back. Most of us only get the burning. Burn well, then.",
    ],
    roommates: {
      "wd-shenbai": ["Zhu Yan threw a ladle at me! It missed. She said that was a lesson about fire. I think it was about ladles.", "Grandfather sent a letter: the rice harvest was good. He says the sect has made me fat. It has!"],
      "wd-yaozhi": ["Zhu Yan apologised. Sort of. She said 'Hmph' at me in a less hostile tone.", "I'm going to brew a pill that makes Murong Xiao tell the truth. It'll be a very small pill. He hardly ever does."],
      "wd-tieniu": ["The burns itch. Wen Ru says itching means healing. Then I'm healing very hard.", "When the furnace went grey, I thought of my father's brazier on winter nights. It never went grey. I want to go home and look at it."],
      "wd-meilan": ["Void-stone eats heat. I tested a crumb. It ate the warmth out of my tea in a breath. Then it ate the warmth out of my finger.", "Someone is getting stones out of the Sealed Hall's foundations. Under the court. There's a way down somewhere."],
      "wd-qiu": ["Zhu Yan let me light furnace two! It's the smallest one. It's mine now. I'm going to call it Feng.", "Tie Niu said my name before anything except dumplings. I'm not crying. Furnace smoke."],
    },
    boss: {
      intro: "The spirit of the Great Furnace rises out of its own coals, a giant made of grey fire with tears of molten slag running down its face.",
      words: [["wd-hm-fire", "It's not angry. It's starving. Answer it!"]],
      fates: [
        { heart: "mercy", label: "Feed it your own fire until it stops crying", line: "She lays her hands on the burning giant and gives it her heat, all of it, until her lips are blue. The grey blushes orange, then gold, and the furnace spirit settles back into its coals like a cat into a lap." },
        { heart: "sword", label: "Strike the void-stone out of its heart", line: "One thrust, through the grey to the black heart of it, and a void-stone the size of a fist rolls smoking across the floor. The fire roars back to gold." },
        { heart: "balance", label: "Let it burn out what it swallowed, slowly", line: "She stands with the furnace through the night, guiding the void out of it a breath at a time, until by dawn it burns clean and small and patient." },
        { heart: "slaughter", label: "Swallow its fire", line: "She opens her mouth and draws the furnace's fire into herself. It is enormous and it burns all the way down. The Great Furnace is cold, and will never be lit again." },
      ],
      victory: "The Red Furnace stands. Zhu Yan sits down on the floor among the ashes and laughs until she cries, and then gives everyone the afternoon off, which has never happened before.",
    },
  },
  // ------------------------------------------------------------------------------------------------ V · earth
  {
    dao: "earth",
    title: "The Ground Beneath the Halls",
    hanzi: "殿下之土",
    level: 8,
    teacher: "wd-hm-earth",
    beats: [
      {
        step: 0,
        npc: "wd-hm-earth",
        title: "One Word a Day",
        objective: "The ground under the Ten Halls has shaken. Your fifth year belongs to the Hall of Bearing: report to Hall Master Hou Tu.",
        lines: [
          ["narr", "The night the furnace spirit was calmed, the earth under the Ten Halls shook, and the court's west wall cracked from top to bottom."],
          ["narr", "Hall Master Hou Tu is the size of a door and says one word a day. He looks at her for a long time, hands her a stone as big as her head, and says today's word."],
          ["wd-hm-earth", "“Carry.”"],
          { a: "hero", n: "carry" },
        ],
        done: "The west wall is cracked from top to bottom, and the Hall of Bearing is rebuilding it a stone at a time.",
      },
      {
        step: 10,
        npc: "wd-tieniu",
        title: "The Ox and the Mountain",
        objective: "Tie Niu is happier than you have ever seen him. Ask him why, in Room Seven.",
        lines: [
          ["wd-tieniu", "Carrying! A whole hall about carrying! I'm good at carrying! Hou Tu nodded at me. Twice. Shen Bai says that's practically a speech."],
          ["wd-tieniu", "He made me carry the same stone round the court a hundred times. Then he took it off me and said 'Again' tomorrow. Two words in two days. For me!"],
        ],
        done: "Tie Niu has found his hall.",
      },
      {
        step: 20,
        npc: "wd-hm-earth",
        title: "Hold",
        objective: "Hou Tu has a lecture at the Hall of Bearing. It will be short.",
        lines: [
          ["wd-hm-earth", "“Hold.”"],
          { a: "hero", n: "carry" },
          ["narr", "She holds the stone above her head until the sun has moved a hand's width across the sky. Her arms stop hurting at some point, and then she is not holding the stone. The earth is holding it, through her."],
        ],
        done: "The earth holds the stone, through her.",
      },
      {
        step: 30,
        npc: "wd-shenbai",
        title: "The Hour of Shaking",
        objective: "Shen Bai has noticed something about the tremors. Hear him out in Room Seven.",
        lines: [
          ["wd-shenbai", "The ground shakes every night at the third watch. Always the third watch. I've felt it every night for a month, in my bunk."],
          ["wd-shenbai", "At home the ground only shook like that when they were digging the new well. Thump. Thump. Somebody's digging, Lin Yue. Under us."],
        ],
        choice: {
          prompt: "Third watch, every night.",
          options: [
            { heart: "balance", label: "Lie with your ear to the floor tonight", then: "She lies with her ear on the floorboards through the third watch. Thump. Thump. Toward the corner of the court.", reply: ["wd-shenbai", "See? Toward the corner. Always toward the corner."] },
            { heart: "sword", label: "Wait at the corner hall with a lantern", then: "She waits by the Sealed Hall at the third watch. The ground shakes under her feet, and nothing comes out.", reply: ["wd-shenbai", "Under it, then. Not in it. Under."] },
            { heart: "mercy", label: "Tell the row, so nobody's frightened", then: "She tells the whole row it is only digging. The younger ones sleep better.", reply: ["wd-shenbai", "The first-years were sure it was a dragon. They're a bit disappointed."] },
            { heart: "slaughter", label: "Stamp back, hard, and see what stops", then: "She stamps her qi down into the earth at the third watch. The digging stops for one night. The next night it is twice as loud.", reply: ["wd-shenbai", "Now it knows we know."] },
          ],
        },
        done: "Someone is digging under the court, at the third watch, toward the Sealed Hall.",
      },
      {
        step: 40,
        npc: "wd-meilan",
        title: "Mei Lan's Map",
        objective: "Mei Lan has a new map spread on the table in Room Seven.",
        lines: [
          ["wd-meilan", "The library has the old builders' plans. There are tunnels under the court from the founder's day. Drains, cellars, a cold store. One of them runs under the Sealed Hall."],
          ["wd-meilan", "I've been looking for someone since before the Selection. I came here to find them. I'll tell you who when I'm sure. I'm nearly sure."],
        ],
        choice: {
          prompt: "Mei Lan is keeping a secret.",
          options: [
            { heart: "mercy", label: "“Whenever you're ready.”", then: "She tells Mei Lan she doesn't have to say anything until she wants to.", reply: ["wd-meilan", "…Thank you. You'll be the first."] },
            { heart: "balance", label: "“Then let's be sure together.”", then: "She offers to help her become sure.", reply: ["wd-meilan", "Together. Yes. Bring a lantern."] },
            { heart: "sword", label: "“Tell me now. It might matter tonight.”", then: "She presses, gently but firmly.", reply: ["wd-meilan", "It might. It isn't tonight. Trust me a little longer."] },
            { heart: "slaughter", label: "Read her notes while she sleeps", then: "She reads Mei Lan's notes by moonlight. The same name is written on every page, over and over: Ning.", reply: ["wd-meilan", "You read them. I can tell. …I would have told you."], effect: feed(2) },
          ],
        },
        done: "There are tunnels under the court, and one runs under the Sealed Hall.",
      },
      {
        step: 60,
        npc: "wd-hm-earth",
        title: "Below",
        objective: "Hou Tu wants you at the Hall of Bearing at the third watch.",
        lines: [
          ["narr", "At the third watch Hou Tu lifts a flagstone no one else in the court could lift, and goes down into the dark without a lantern, and she follows."],
          ["narr", "The tunnels are old, and someone has been using them: fresh drag marks in the dust, chips of void-stone, and at the end, under the corner of the court, a round door of black stone carved with a closed eye."],
          ["wd-hm-earth", "“Below.”"],
        ],
        done: "Under the Sealed Hall there is a round door carved with a closed eye, and fresh drag marks lead to it.",
      },
      {
        step: 70,
        npc: "wd-qiu",
        title: "A Sandal",
        objective: "Little Qiu followed you into the tunnels. He is back in Room Seven, holding something.",
        lines: [
          ["wd-qiu", "It was by the black door, in the dust. A sandal. Look at the sole."],
          ["narr", "Burned into the sole with a hot nail, the way village boys mark their things so their brothers can't steal them: 'QF'."],
          ["wd-qiu", "He was there. He was right there. Behind that door."],
        ],
        choice: {
          prompt: "Qiu is shaking.",
          options: [
            { heart: "mercy", label: "Hold him until he stops shaking", then: "She holds him. It takes a long time.", reply: ["wd-qiu", "Behind that door. Behind a door. Not dead. Behind a door."], effect: quiet(2) },
            { heart: "balance", label: "“A sandal means he walked there. People who walk can walk back.”", then: "She tells him it was a sandal, not a bone.", reply: ["wd-qiu", "Not a bone. Not a bone. You're right."] },
            { heart: "sword", label: "“Then we open the door.”", then: "She says it simply, and means it.", reply: ["wd-qiu", "First. You go first. You promised."] },
            { heart: "slaughter", label: "“Or what was left of him did.”", then: "She says it before she can stop herself.", reply: ["wd-qiu", "…Get out. Please. Just for tonight."], effect: feed(2) },
          ],
        },
        done: "Qiu Feng's sandal sits on Qiu's pillow. He sleeps beside it.",
      },
      {
        step: 80,
        npc: "wd-yanshu",
        title: "The Examiner's Order",
        objective: "Examiner Yan Shu has summoned you to the east gate, where he keeps his register.",
        lines: [
          ["wd-yanshu", "Outer disciples have been seen in the old tunnels. They are unsafe. They will be sealed tonight, and anyone found in them will be sent home."],
          ["wd-yanshu", "You have such a bright future, Lin Yue. The stone thought so too. It would be a pity to lose it in a hole in the ground."],
          ["narr", "Behind her, Hall Master Hou Tu, who has already said his word today, says another."],
          ["wd-hm-earth", "“No.”"],
          ["narr", "The Examiner looks at the Hall Master for a long moment, and smiles, and goes inside."],
        ],
        done: "Hou Tu said two words in one day, and the second one was to the Examiner.",
      },
      {
        step: 90,
        npc: "wd-hm-earth",
        title: "The Warden Wakes",
        objective: "The ground is shaking in daylight. Find Hou Tu at the Hall of Bearing.",
        lines: [
          ["narr", "The old builders set a guardian of stone in the tunnels, to keep the founder's cellars. Someone with the Examiner's seal has woken it and set it to seal the tunnels with everyone in them."],
          ["wd-hm-earth", "“Hold.”"],
        ],
        done: "The Warden of the Deep Tunnels has climbed up out of the earth into the court.",
      },
      {
        step: 98,
        npc: "wd-tieniu",
        title: "Hold the Roof",
        objective: "Tie Niu is going down into the tunnels. Stop him or go with him (Room Seven).",
        lines: [
          ["wd-tieniu", "First-years went down this morning on a dare. The roof's coming down on them. I can hold a roof. Hou Tu taught me. You stop the stone man."],
          { a: "wd-tieniu", n: "carry" },
        ],
        done: "Tie Niu holds the tunnel roof on his shoulders while the first-years crawl out under his arms.",
      },
    ],
    lectures: [
      "“Carry.”",
      "“Hold.”",
      "“Again.”",
      "“Under.”",
      "“Patience.” (He seems pleased with that one; it is four syllables.)",
      "“Others.” (He points at the wall, at the terraces, at the ground under the dormitories, at her.)",
    ],
    roommates: {
      "wd-shenbai": ["Soil, I understand. Rock is just very old soil that got stubborn.", "Hou Tu looked at my hoe and said 'Good.' I'm going to frame the hoe."],
      "wd-yaozhi": ["My hands. Look at my hands. Calluses. My mother will faint. I'm rather proud.", "Murong carried stones beside me all morning without saying a word. Hou Tu's hall does something to people."],
      "wd-tieniu": ["Today's word was 'Others'. He pointed at me. I think he meant I carry for others. I do. It's the best kind.", "I can feel the ground breathe now, if I stand still. Slow. Like a sleeping cow."],
      "wd-meilan": ["The builders' plans have a door on them with an eye drawn on it, and one word: 'Never'.", "I'm nearly sure now. Nearly."],
      "wd-qiu": ["I'm not allowed in the tunnels. I'm small enough for the tunnels. That's not fair.", "Feng's sandal still fits me. Almost. He always had big feet."],
    },
    boss: {
      intro: "The Warden of the Deep Tunnels heaves itself out of the cracked earth: a guardian of old grey stone, eyes like lamps, moving with the slow certainty of a landslide.",
      words: [["wd-hm-earth", "“Gently.”"]],
      fates: [
        { heart: "mercy", label: "Send it back to sleep", line: "She sings it the builders' lullaby carved on its own back, and the Warden of the Deep Tunnels lies down in the court like an old dog by a fire, and sleeps." },
        { heart: "sword", label: "Break the seal that woke it", line: "She finds the Examiner's seal pressed into its brow and strikes it out. The Warden stops, looks round as if waking, and walks back down into the earth to its post." },
        { heart: "balance", label: "Give it to the earth to hold", line: "She lays her palms on it and on the ground and lets the earth take its weight back. The Warden settles, stone into stone, and becomes the new foot of the west wall." },
        { heart: "slaughter", label: "Shatter it", line: "She shatters it into a thousand pieces. The tunnels behind it collapse with a long grinding sigh. Whatever was down there is buried deeper now." },
      ],
      victory: "The court is still. Tie Niu climbs out of the tunnel with dirt in his hair and three first-years under each arm, and Hou Tu says, for the first time anyone can remember, a whole sentence: “That is my disciple.”",
    },
  },
  // ------------------------------------------------------------------------------------------------ VI · metal
  {
    dao: "metal",
    title: "The Unfinished Sword",
    hanzi: "未竟之剑",
    level: 10,
    teacher: "wd-hm-metal",
    beats: [
      {
        step: 0,
        npc: "wd-hm-metal",
        title: "Keep Your Edge",
        objective: "Your sixth year belongs to the Hall of the Edge. Report to Hall Master Jin Ge at his forge.",
        lines: [
          ["wd-hm-metal", "Jin Ge. Every disciple of the Edge forges their own sword. It takes a year. Most of the year is waiting."],
          ["wd-hm-metal", "An edge is only the shape the metal agreed to keep. Keep your edge, keep your word. If you can't do the second, don't bother with the first."],
          { a: "hero", n: "hammer" },
        ],
        done: "A bar of grey iron sits on her anvil. It will be a sword in a year, if she keeps her word to it.",
      },
      {
        step: 10,
        npc: "wd-yaozhi",
        title: "A Word Given for Her",
        objective: "Yao Zhi has a question about words, in Room Seven.",
        lines: [
          ["wd-yaozhi", "Jin Ge says keep your word. My family gave my word to the Murongs. Not me. Them. Is a word given for you still yours to keep?"],
        ],
        choice: {
          prompt: "Yao Zhi actually wants an answer.",
          options: [
            { heart: "balance", label: "“A word is only yours if you gave it.”", then: "She says a promise made by someone else is their promise.", reply: ["wd-yaozhi", "Their promise. Their problem. I'm going to have that embroidered."] },
            { heart: "mercy", label: "“Ask your family to give it back.”", then: "She suggests asking, kindly, before anything else.", reply: ["wd-yaozhi", "Ask. Kindly. My family. …It's so mad it might work."] },
            { heart: "sword", label: "“Break it, then, and say so.”", then: "She says a word you never gave can be broken cleanly.", reply: ["wd-yaozhi", "Cleanly. Like a blade. Jin Ge would approve."] },
            { heart: "slaughter", label: "“Keep it, and make them regret it.”", then: "She says the cruellest revenge is to keep the word and become the Murongs' worst daughter-in-law.", reply: ["wd-yaozhi", "…Tempting. Horribly tempting."] },
          ],
        },
        done: "Yao Zhi has started forging a sword. She says it is for cutting words.",
      },
      {
        step: 20,
        npc: "wd-hm-metal",
        title: "The Sword on the Wall",
        objective: "Jin Ge has something to show you in the Hall of the Edge.",
        lines: [
          ["narr", "On the forge wall hangs a blade with no hilt, its edge drawn only halfway along. It is the only unfinished thing in Jin Ge's hall."],
          ["wd-hm-metal", "I promised it to a first-year six years ago. A boy who sang badly at the anvil on purpose to make the others laugh. He went home before it was done, says the register."],
          ["wd-hm-metal", "Qiu Feng. I keep my word. I finished the edge on the morning he was meant to collect it. He never came."],
        ],
        done: "Qiu Feng's sword hangs half-finished on Jin Ge's wall.",
      },
      {
        step: 30,
        npc: "wd-qiu",
        title: "His Brother's Sword",
        objective: "Jin Ge gave Little Qiu his brother's sword. Qiu is in Room Seven with it across his knees.",
        lines: [
          ["wd-qiu", "Jin Ge says it's mine until Feng comes for it. He said 'until'. Not 'unless'. Until."],
          ["wd-qiu", "It's too big for me. I can't even lift it properly. What do I do with a sword I can't lift?"],
        ],
        choice: {
          prompt: "Qiu is holding a sword far too big for him.",
          options: [
            { heart: "mercy", label: "“Keep it safe for him. That's enough.”", then: "She helps him wrap it in his own blanket.", reply: ["wd-qiu", "I'll sleep cold. He'd do it for me. He did, once."] },
            { heart: "sword", label: "“Train until you can lift it.”", then: "She shows him how to hold it two-handed, point down, and how to breathe.", reply: ["wd-qiu", "Every morning. Before hot water. I'll lift it by the time he comes."] },
            { heart: "balance", label: "“Finish the hilt. Make it his and yours.”", then: "She suggests he carve the hilt himself.", reply: ["wd-qiu", "His blade, my hilt. Half each. Like brothers."] },
            { heart: "slaughter", label: "“Use it on whoever took him.”", then: "She says a sword is for one thing.", reply: ["wd-qiu", "…Feng hated fighting. He'd hate that."] },
          ],
        },
        done: "Qiu Feng's sword has a home in Room Seven, until.",
      },
      {
        step: 40,
        npc: "wd-murong",
        title: "Murong Breaks His Word",
        objective: "Murong Xiao has done something reckless in the dining hall. Find him by the ring.",
        lines: [
          ["wd-murong", "I stood on a bench in the dining hall and said I will not marry Yao Zhi, that the word was never mine, and that I'd keep my own word instead. Then I fell off the bench."],
          ["wd-murong", "My uncle has cut me off. No money, no clan robe, no name. Murong Xiao, outer disciple, with one robe. Can I eat at Room Seven's table? I'm told the dumplings are squashed but good."],
        ],
        choice: {
          prompt: "Murong Xiao is asking to sit with Room Seven.",
          options: [
            { heart: "mercy", label: "Make room on the bench", then: "She shoves up. Tie Niu shoves up. Murong Xiao sits down and nobody says anything clever.", reply: ["wd-murong", "…Thank you. That is the first thing I have ever not paid for."] },
            { heart: "balance", label: "“Ask Yao Zhi. It's her table too.”", then: "She leaves it to Yao Zhi, who looks at him for a long time and then hands him chopsticks.", reply: ["wd-murong", "She handed me chopsticks. That's a treaty, among the Golden Pavilion."] },
            { heart: "sword", label: "“Earn it. Carry Gou's water for a month.”", then: "She tells him a place at the table is earned.", reply: ["wd-murong", "Water. For a month. …Fine. I'll be the best water-carrier this court has ever seen."] },
            { heart: "slaughter", label: "“Beg.”", then: "She makes him ask twice.", reply: ["wd-murong", "Please. There. Twice. I'll remember that, and so will you."], effect: feed(1) },
          ],
        },
        done: "There are seven at Room Seven's table now.",
      },
      {
        step: 60,
        npc: "wd-hm-metal",
        title: "Fire and Water",
        objective: "Your blade is ready to quench. Jin Ge is waiting at the forge.",
        lines: [
          ["wd-hm-metal", "Red heat, then the trough. Too slow and it's soft. Too fast and it cracks. Steel is iron that went through fire and water and didn't give up."],
          { a: "hero", n: "hammer" },
          ["narr", "The blade screams in the water, and goes quiet, and comes out grey and hard and true."],
          ["wd-hm-metal", "Hm. No crack. You held your nerve. Most don't."],
        ],
        done: "Her blade is quenched, and does not crack.",
      },
      {
        step: 70,
        npc: "wd-shenbai",
        title: "A Sword Like a Hoe",
        objective: "Shen Bai's sword is finished. He wants to show you in Room Seven, and is embarrassed.",
        lines: [
          ["wd-shenbai", "I meant to make a sword. I kept thinking about the field. It came out… hoe-shaped. Broad. Sort of a blade on a long handle."],
          ["wd-shenbai", "Jin Ge looked at it for ages. Then he said, 'Good. It is the shape you agreed to keep.' He said it was the most honest blade in the hall this year!"],
        ],
        done: "Shen Bai's sword-hoe hangs above his bunk. He polishes it every night.",
      },
      {
        step: 80,
        npc: "wd-yaozhi",
        title: "Keeping Her Word",
        objective: "Yao Zhi has written a letter she is afraid to send. She is in Room Seven.",
        lines: [
          ["wd-yaozhi", "To my uncle. I've told him I know about the Essence Pills, and that if he does not tell me where they come from, I'll tell the magistrate in Jinhe and sign it Yao Zhi of the Golden Pavilion."],
          ["wd-yaozhi", "My name on it. My word. That's the only edge I have. I'm going to keep it."],
          { a: "wd-yaozhi", n: "write" },
        ],
        done: "Yao Zhi's letter goes south with her name on it.",
      },
      {
        step: 90,
        npc: "wd-hm-metal",
        title: "The Naming",
        objective: "It is the day of the Sword-Naming. Jin Ge is in the ring.",
        lines: [
          ["wd-hm-metal", "Every blade finished this year crosses mine before it gets its name. Not to win. To show me it keeps its edge when it is struck."],
          ["wd-hm-metal", "Yours is last. Bring it to the ring."],
        ],
        done: "Jin Ge stands in the ring with his own old sword, waiting.",
      },
      {
        step: 98,
        npc: "wd-yaozhi",
        title: "Edge",
        objective: "Yao Zhi wants to wish you luck before the Naming, in Room Seven.",
        lines: [
          ["wd-yaozhi", "Don't lose. If you lose, Murong will be insufferable about how he'd have done it, and I'll have to listen."],
          ["wd-yaozhi", "…And keep your edge. Whatever happens in that sealed hall in the end. Keep it."],
        ],
        done: "The court gathers round the ring for the Sword-Naming.",
      },
    ],
    lectures: [
      "Metal remembers every blow you give it. Hit it right the first time.",
      "Hard is not strong. Too hard and it shatters. Let it give a little.",
      "You can melt a sword down and make a plough. You cannot do that with a grudge.",
      "Bronze bell, iron plough, silver hairpin. One Dao, different promises.",
      "A sword in its sheath is still sharp. So is a word you have not said yet.",
      "Gold does not rust. People think that makes it noble. I think it makes it lonely.",
    ],
    roommates: {
      "wd-shenbai": ["I keep my sword-hoe sharp. You never know when a weed will attack.", "Grandfather wrote: he's bought a new ox. With money I sent. From missions! I'm a working cultivator!"],
      "wd-yaozhi": ["My blade's thin and quick and has a gold thread in the hilt. Obviously. I'm still a Yao.", "Murong eats like a starving dog now. I've started saving him my dumplings. Don't look at me like that."],
      "wd-tieniu": ["My sword broke. Jin Ge said I hit too hard. I made a hammer instead. He said, that's the shape you agreed to keep.", "Murong carries Gou's water every morning now. He's terrible at it. He spills half. He keeps going."],
      "wd-meilan": ["I've made a brush, not a sword. Jin Ge let me. He said a word can keep an edge too.", "The Examiner watches the Naming every year. He never names a sword himself. He has never forged one."],
      "wd-qiu": ["I can lift Feng's sword now! For a breath. Then it falls over and I fall over. But I lift it!", "I carved a frog on the hilt. Feng loved frogs. He'll laugh."],
    },
    boss: {
      intro: "Jin Ge raises his old sword. It has been sharpened so many times it is half the width it was. It is still the sharpest thing in the court.",
      words: [["wd-hm-metal", "Show me it keeps its edge when I strike it. Then name it."]],
      fates: [
        { heart: "mercy", label: "Name it Shelter", line: "She names it Shelter. Jin Ge cuts the name into the tang himself and says, “A sword that means to stand in front of people. Good. Keep it.”" },
        { heart: "sword", label: "Name it First Frost", line: "She names it First Frost, after a sword she once heard of that was never drawn in anger. Jin Ge is quiet a moment. “Then draw it only when you must,” he says." },
        { heart: "balance", label: "Leave it unnamed", line: "She tells him it can name itself, when it has done something worth a name. Jin Ge laughs aloud, which nobody has heard before, and leaves the tang blank." },
        { heart: "slaughter", label: "Name it Grudge", line: "She names it Grudge. Jin Ge cuts the name, slowly, and says nothing at all, and that is the worst thing he could have said." },
      ],
      victory: "Her blade rings against Jin Ge's and keeps its edge. On the forge wall, behind him, Qiu Feng's unfinished sword hangs no longer: it is wrapped in a blanket on a bunk in Room Seven, waiting.",
    },
  },
  // ------------------------------------------------------------------------------------------------ VII · thunder
  {
    dao: "thunder",
    title: "The Discipline Cliff",
    hanzi: "惩戒崖",
    level: 11,
    teacher: "wd-hm-thunder",
    beats: [
      {
        step: 0,
        npc: "wd-hm-thunder",
        title: "Accused",
        objective: "Hall Master Lei Ting has summoned you to the Hall of Discipline.",
        lines: [
          ["wd-hm-thunder", "Lin Yue. A witness swears he saw you carry Outer Disciple Lu Ping toward the Sealed Hall on the night Lu Ping 'went home'."],
          ["wd-hm-thunder", "You will stay in the Outer Court until the hearing. Your seventh year belongs to my hall now, whether you like it or not. Thunder is heaven's voice. It is never wrong twice."],
        ],
        done: "She is accused of the disappearances. The court whispers when she passes.",
      },
      {
        step: 10,
        npc: "wd-gou",
        title: "Steward Gou's Word",
        objective: "Steward Gou is waiting outside the dormitories.",
        lines: [
          ["wd-gou", "I've told Lei Ting. I do the night count. Forty years, every bunk, every night. You were in yours the night Lu Ping went. Snoring, if you want to know. You snore, girl."],
          ["wd-gou", "She says a steward's count is not enough against a sworn witness. We'll see."],
        ],
        done: "Steward Gou has given his word for her. It is not enough. Yet.",
      },
      {
        step: 20,
        npc: "wd-hm-thunder",
        title: "Strike Once",
        objective: "Lei Ting will see you at the Hall of Discipline, accused or not: you are still her disciple.",
        lines: [
          ["wd-hm-thunder", "Lightning does not strike twice in the same place because it does not need to. Decide. Strike once. Be sure."],
          ["wd-hm-thunder", "I am not sure about you, Lin Yue. That is why you are not yet on the cliff. Give me a reason to be sure, one way or the other."],
          { a: "hero", n: "salute" },
        ],
        done: "Lei Ting is not sure. For her, that is almost kindness.",
      },
      {
        step: 30,
        npc: "wd-meilan",
        title: "An Alibi With a Secret",
        objective: "Mei Lan has her notes from the night Lu Ping vanished, in Room Seven.",
        lines: [
          ["wd-meilan", "I write down everything. That night: 'Second watch, L.Y. asleep, snoring. Third watch, L.Y. asleep.' It proves you never left."],
          ["wd-meilan", "But it also proves I was awake and out of my bunk at the third watch, writing it at the window. If I testify they'll ask me why. And I can't tell them. Not yet."],
        ],
        choice: {
          prompt: "Mei Lan could clear you, at a cost to herself.",
          options: [
            { heart: "mercy", label: "“Keep your secret. I'll find another way.”", then: "She tells Mei Lan not to testify.", reply: ["wd-meilan", "…You'd stay accused for me? I'll find you another way, then. I promise."], effect: quiet(1) },
            { heart: "balance", label: "“Testify to what you saw, and only that.”", then: "She tells her to answer only what she is asked.", reply: ["wd-meilan", "Only what I'm asked. Lei Ting asks a great deal. I'll try."] },
            { heart: "sword", label: "“Testify. The truth is the truth.”", then: "She asks her to tell it all.", reply: ["wd-meilan", "All of it. …Not yet. Give me until the Library. Please."] },
            { heart: "slaughter", label: "Take the notes to Lei Ting yourself", then: "She takes the notes without asking.", reply: ["wd-meilan", "Those were MINE. …Lei Ting has them now. And she knows I was awake."], effect: feed(2) },
          ],
        },
        done: "Mei Lan's notes say she slept. They say Mei Lan didn't.",
      },
      {
        step: 40,
        npc: "wd-murong",
        title: "A Murong Testifies",
        objective: "Murong Xiao has done something brave. Find him by the ring.",
        lines: [
          ["wd-murong", "I told Lei Ting the truth. That night my uncle Murong Hong came to the court after curfew, and went to the Examiner's rooms, and they went out together toward the corner of the court."],
          ["wd-murong", "My uncle will hear of it. I've no clan left to lose. It's very freeing, being poor. I recommend it."],
        ],
        done: "Murong Xiao has testified against his own uncle.",
      },
      {
        step: 60,
        npc: "wd-hm-thunder",
        title: "The Thunder Cliff",
        objective: "Lei Ting has sent you to the Thunder Cliff behind the Hall of Discipline: one night under heaven's storm.",
        lines: [
          ["narr", "The Thunder Cliff is a ledge on which the sect's accused spend a night in the storm. Heaven, they say, strikes the guilty. It is mostly a test of nerve. Mostly."],
          ["narr", "At midnight the sky opens, and the lightning walks along the cliff toward her, one bolt at a time."],
        ],
        choice: {
          prompt: "The storm is on the cliff.",
          options: [
            { heart: "balance", label: "Sit still and let heaven look", then: "She sits in the open and lets the lightning come. It strikes either side of her, all night, and never her.", reply: ["wd-hm-thunder", "Heaven looked at you all night and found nothing to strike. So did I."] },
            { heart: "sword", label: "Stand, and stare it down", then: "She stands at the edge with her sword raised, and the lightning comes down onto the blade and runs harmlessly into the rock.", reply: ["wd-hm-thunder", "You drew it onto yourself and lived. That is not innocence. That is courage. I'll take it."] },
            { heart: "mercy", label: "Shelter the other accused", then: "There is a first-year on the cliff too, accused of stealing rice. She holds her cloak over him all night.", reply: ["wd-hm-thunder", "You spent your night of judgment keeping a rice thief dry. …I have been doing this job wrongly for a long time."] },
            { heart: "slaughter", label: "Call the lightning down on purpose", then: "She calls it down on herself, deliberately, again and again, until the cliff is black glass.", reply: ["wd-hm-thunder", "Anyone who does that is either very innocent or very dangerous. I will find out which."], effect: feed(3) },
          ],
        },
        done: "She came down from the Thunder Cliff in the morning, unburned.",
      },
      {
        step: 70,
        npc: "wd-hm-wind",
        title: "The Paid Witness",
        objective: "Feng Qi has been listening at windows. Find him at the Hall With No Walls.",
        lines: [
          ["wd-hm-wind", "I'm the wind. I hear things. The witness against you was paid. Ten silver taels, from Enforcer Captain Kui, in the stables, at night."],
          ["wd-hm-wind", "Kui takes his orders from the Examiner's seal. Everyone knows it and nobody says it. I just said it. I'm going to go and stand somewhere draughty for a while."],
        ],
        done: "The witness was paid, by Enforcer Captain Kui.",
      },
      {
        step: 80,
        npc: "wd-hm-thunder",
        title: "Proof",
        objective: "Take what Feng Qi heard to Lei Ting at the Hall of Discipline.",
        lines: [
          ["wd-hm-thunder", "A Hall Master's hearsay against the captain of my own enforcers. Not enough. Bring me Kui, and I will hear him myself."],
          ["wd-hm-thunder", "And Lin Yue: be careful. A man who would pay a witness would do worse to stop being found out."],
        ],
        done: "Lei Ting wants Kui. Kui knows she wants him.",
      },
      {
        step: 90,
        npc: "wd-fanyu",
        title: "Ambush at the Mission Hall",
        objective: "Senior Sister Fan Yu has asked you to come to the Mission Hall after curfew. Something about the board.",
        lines: [
          ["wd-fanyu", "I didn't send for you. Somebody used my name. Go back to — "],
          ["narr", "Lanterns go out all round the square at once. Out of the dark come enforcers in black, and at their head, Captain Kui with his chain-whip."],
        ],
        done: "Enforcer Captain Kui has come for her in the dark.",
      },
      {
        step: 98,
        npc: "wd-hm-thunder",
        title: "Heaven's Voice",
        objective: "Lei Ting has heard the noise. She is at the Hall of Discipline, waiting to see what you do.",
        lines: [
          ["wd-hm-thunder", "I will not lift a hand until I am sure. Make me sure."],
        ],
        done: "Captain Kui waits by the Hall of Discipline, his chain-whip crackling.",
      },
    ],
    lectures: [
      "You see the lightning before you hear it. Heaven acts first, and explains later.",
      "A storm clears the air. Afterwards everything smells new. Discipline should do the same.",
      "Speak like thunder: once, and mean it. Then be quiet a long while.",
      "The first thunder of spring, and the frogs start singing, as if they had been waiting for permission. Give people permission.",
      "Heaven is angry for an instant. The rain afterward lasts all night. That is mercy, and it is also thunder.",
      "Count between the flash and the boom. Five, and it is far. One, and you pray.",
    ],
    roommates: {
      "wd-shenbai": ["I told Lei Ting you snore. She wrote it down! You're being saved by snoring.", "Grandfather says when the thunder comes, the rice wakes up. I hope you wake them all up."],
      "wd-yaozhi": ["Being accused is very fashionable in Jinhe. Every good family has a scandal. You're our scandal. I'm almost proud.", "My uncle hasn't answered. He's frightened. Good."],
      "wd-tieniu": ["If they put you on the cliff, I'll stand at the bottom all night. I can't stop lightning. I can stand at the bottom.", "Murong sat with me at breakfast. He said his uncle used to buy him sweets. He looked very sad."],
      "wd-meilan": ["Third watch. Two bearers. If they were Kui's enforcers, they wore grey over their black.", "I'll tell you everything soon. After the Library. The Library has what I need."],
      "wd-qiu": ["Lei Ting nodded at me today! She nods at staff. I'm STAFF.", "Nobody in the row believes it was you. Except Hou Er. Nobody likes Hou Er."],
    },
    boss: {
      intro: "Enforcer Captain Kui swings his chain-whip, and it cracks with stolen lightning.",
      words: [["wd-kui", "Nothing personal, outer disciple. The seal says you go home tonight. Everyone the seal says goes home."]],
      fates: [
        { heart: "mercy", label: "Bind his wounds, and ask him why", line: "She binds his wounds with strips of her own sleeve, and asks him why. He tells her: the seal paid his mother's debts, and kept paying, and then it owned him." },
        { heart: "sword", label: "Drag him before Lei Ting", line: "She drags Captain Kui across the square by his own chain and drops him on the steps of the Hall of Discipline. Lei Ting looks down at him and says, “Now I am sure.”" },
        { heart: "balance", label: "Make him confess where all can hear", line: "She waits until the lanterns are lit and the whole row has come out to look, and then asks him, quietly, who sent him. He tells them all." },
        { heart: "slaughter", label: "Break the arm that holds the whip", line: "She breaks the arm that holds the whip. He confesses through his teeth. The row watches her very carefully from then on." },
      ],
      victory: "Kui confesses: he took his orders from the Examiner's seal, though he never once saw the hand that held it. Lei Ting clears Lin Yue's name in front of the whole court, and then, after a long moment, bows to her.",
    },
  },
  // ------------------------------------------------------------------------------------------------ VIII · ice
  {
    dao: "ice",
    title: "The Library of Frozen Words",
    hanzi: "冻字书阁",
    level: 13,
    teacher: "wd-hm-ice",
    beats: [
      {
        step: 0,
        npc: "wd-hm-ice",
        title: "What Melts in Your Hands",
        objective: "Your eighth year belongs to the Library of Frozen Words. Report to Hall Master Han Shuang.",
        lines: [
          ["wd-hm-ice", "Han Shuang. Every record in this library is sealed in ice. You may read only what melts in your hands."],
          ["wd-hm-ice", "Most of it melts for no one. Ice is water that has decided, and these records have decided who may read them."],
          { a: "hero", n: "read" },
        ],
        done: "On her first day, one small record melts in her hands: a list of the founder's favourite teas.",
      },
      {
        step: 10,
        npc: "wd-hm-ice",
        title: "Ice Is Water That Decided",
        objective: "Han Shuang is lecturing in the Library of Frozen Words.",
        lines: [
          ["wd-hm-ice", "Water goes where it is pushed. Ice has decided. That is the whole difference. Decide what you are, and hold it, and when the spring comes, decide again."],
          ["wd-hm-ice", "The records that melt for you are the ones that think you have decided. Have you?"],
        ],
        done: "The ice on the next shelf softens a little when she touches it.",
      },
      {
        step: 20,
        npc: "wd-meilan",
        title: "Mei Lan's Name",
        objective: "Mei Lan has asked you to sit with her in Room Seven. She has something to tell you.",
        lines: [
          ["wd-meilan", "I said I'd tell you first. My name isn't really Mei Lan. It's Ning Meilan. My grandfather was Ning Wuhen, master of the Hall of the Void, sixty years ago."],
          ["wd-meilan", "He vanished the night his hall was sealed. My grandmother never stopped looking. When she died, she gave me his letters. The last one says: 'I am holding the door. Do not let them open it.'"],
        ],
        choice: {
          prompt: "Mei Lan has told you her secret.",
          options: [
            { heart: "mercy", label: "“Then we'll find him together.”", then: "She takes Mei Lan's ink-stained hand.", reply: ["wd-meilan", "Together. Room Seven always finds things. Eventually."], effect: quiet(2) },
            { heart: "balance", label: "“Holding the door. From which side?”", then: "She reads the letter twice and asks the question nobody has asked.", reply: ["wd-meilan", "…From the inside. Oh. Oh, Lin Yue. From the inside."] },
            { heart: "sword", label: "“Then nobody opens it but us.”", then: "She swears it.", reply: ["wd-meilan", "Not the Examiner. Not anyone. Us."] },
            { heart: "slaughter", label: "“Your grandfather's sixty years dead.”", then: "She says what everyone else must have thought.", reply: ["wd-meilan", "Grandmother heard that every day for sixty years. I'm used to it. It's still not true."] },
          ],
        },
        done: "Mei Lan is Ning Meilan, granddaughter of the lost master of the Void.",
      },
      {
        step: 30,
        npc: "wd-hm-ice",
        title: "The Register of Sixty Years Ago",
        objective: "A record has melted for you in the Library. Show it to Han Shuang.",
        lines: [
          ["narr", "The record that melts in her hands is the sect's register for the night the Hall of the Void was sealed, sixty years ago."],
          ["wd-hm-ice", "'Hall Master Ning Wuhen sealed the Hall of the Void at the third watch, and was not seen again. His sole disciple, Yan Shu, reported it at dawn.'"],
          ["wd-hm-ice", "His sole disciple. The Examiner. I have shelved this record every year for forty years. It has never melted for me. It melted for you."],
        ],
        done: "Yan Shu was Ning Wuhen's only disciple, and the one who reported him gone.",
      },
      {
        step: 40,
        npc: "wd-qiu",
        title: "Affinity: Void",
        objective: "Little Qiu has been reading over Han Shuang's shoulder. He is waiting in Room Seven.",
        lines: [
          ["wd-qiu", "Han Shuang let me hold my brother's file. It melted! It says: 'Qiu Feng. Affinity: wood, faintly; void, clearly.'"],
          ["wd-qiu", "I made her get Lu Ping's. Void. And the others who went home. Void, void, void. Every one of them. And Lin Yue… the stone. The clear bit. That was void, wasn't it?"],
        ],
        choice: {
          prompt: "Every disciple who 'went home' had an affinity for the void. So do you.",
          options: [
            { heart: "balance", label: "“Then I'm the bait. Good.”", then: "She says it calmly: if they come for her, they lead her to the others.", reply: ["wd-qiu", "That's the bravest stupid thing I've ever heard."] },
            { heart: "mercy", label: "“Then nobody in this room sleeps alone.”", then: "She moves her bunk next to the door, and Tie Niu moves his next to hers.", reply: ["wd-qiu", "Tie Niu says he'll sleep sitting up. He snores sitting up too."] },
            { heart: "sword", label: "“Let them come.”", then: "She lays her sword beside her pillow.", reply: ["wd-qiu", "Let them come. Yes. I'll sleep with Feng's sword too."] },
            { heart: "slaughter", label: "“Then I strike first.”", then: "She says she will not wait to be carried off.", reply: ["wd-qiu", "Strike who, though? We don't even know who carries them."] },
          ],
        },
        done: "Void, every one of them. Room Seven sleeps in shifts now.",
      },
      {
        step: 60,
        npc: "wd-hm-ice",
        title: "The Founder's Winter",
        objective: "Han Shuang has found something that melted for you, and wants you to read it in the Library.",
        lines: [
          ["narr", "A single sheet, in an ice so old it is blue. It melts the moment she touches it."],
          ["narr", "“I came to the Ten Halls sure I knew the Dao. I leave knowing I know nothing, and that is the first true thing I know. The bunk by the window is cold. My roommate snores worse than I do. — Lian Qingxue, outer disciple, Room Seven.”"],
          ["wd-hm-ice", "Your founder. A Daoist called Qingxu came here once, years ago, to beg a copy of that. It never melted for him. He wept."],
        ],
        done: "Lian Qingxue's winter in Room Seven, in her own hand.",
      },
      {
        step: 70,
        npc: "wd-yaozhi",
        title: "The Uncle's Answer",
        objective: "Yao Zhi's uncle has answered at last. She is in Room Seven with the letter.",
        lines: [
          ["wd-yaozhi", "He's terrified. Good. He says the Murong agent told him the Essence Pills are made 'from the breath of sleepers, who will never miss it'."],
          ["wd-yaozhi", "The breath of sleepers. Who sleeps and never wakes, Lin Yue? Who never comes home?"],
        ],
        done: "The Essence Pills are made from the breath of sleepers.",
      },
      {
        step: 80,
        npc: "wd-hm-ice",
        title: "The Deepest Record",
        objective: "Han Shuang will take you to the lowest shelf of the Library of Frozen Words.",
        lines: [
          ["wd-hm-ice", "The deepest record in this library is frozen in a block the size of a coffin. Its label says only: 'The Gate Within the Gate.' It has never melted for anyone."],
          ["wd-hm-ice", "And it is guarded. The founder of the Ten Halls set a warden of frost over it, and the warden decides who reads."],
        ],
        done: "At the bottom of the Library, the Gate Within the Gate, frozen, guarded.",
      },
      {
        step: 90,
        npc: "wd-hm-ice",
        title: "Thaw",
        objective: "Lay your hands on the deepest record in the Library of Frozen Words, with Han Shuang beside you.",
        lines: [
          ["narr", "She lays her hands on the block. The ice begins, very slowly, to weep."],
          ["narr", "Behind it, the Frost Warden of the Library opens eyes like winter stars and stands up out of the floor."],
        ],
        done: "The Frost Warden of the Library has woken to ask whether she has decided.",
      },
      {
        step: 98,
        npc: "wd-meilan",
        title: "Together",
        objective: "Mei Lan has run down to the Library after you. She is in Room Seven gathering her brushes, and will not be left behind.",
        lines: [
          ["wd-meilan", "My grandfather's last secret is in that ice. I'm not waiting upstairs for it."],
          { a: "wd-meilan", n: "token" },
        ],
        done: "The Frost Warden stands between Room Seven and the Gate Within the Gate.",
      },
    ],
    lectures: [
      "Ice is water that made up its mind. Admire it. Then remember that it melts.",
      "In winter the river freezes and you can walk across. In spring you cannot. Know which season you are in.",
      "Cold keeps things. Meat, fish, records, grudges. Be careful what you let freeze.",
      "Snow covers the temple roof and the midden alike, and keeps no list.",
      "Ice melts from the edges in. Most hard things do. Begin at the edges.",
      "A sheet of ice cracks with a sound like a bell, and does not break. Be that.",
    ],
    roommates: {
      "wd-shenbai": ["The Library's so cold my breath freezes on the page. Han Shuang says that's how the records like it.", "Grandfather's ox is called Lin Yue. He thought you'd be honoured. Are you honoured?"],
      "wd-yaozhi": ["Han Shuang's the first person in this sect who's colder than I am. I respect her enormously.", "My uncle's frightened. Frightened people talk. Let's let him talk."],
      "wd-tieniu": ["I sleep sitting up by the door now. I'm getting good at it. I only fell over twice.", "Mei Lan cried last night. I gave her a dumpling. It seemed to help. Dumplings always help."],
      "wd-meilan": ["Ning Meilan. It feels strange to say it aloud. I've been Mei Lan so long.", "From the inside. He's been holding it from the inside. For sixty years."],
      "wd-qiu": ["Void, void, void. And Feng was void. And Lin Yue's void. I'm not void. I'm just a kite-boy. I'll guard the door.", "Han Shuang let me read a record about frogs. It melted for me! Even the ice likes frogs."],
    },
    boss: {
      intro: "The Frost Warden of the Library raises a hand of blue ice. The shelves frost over in a ring round it.",
      words: [["wd-frost", "Have you decided? What will you do with what the ice holds?"]],
      fates: [
        { heart: "mercy", label: "“Save the ones who sleep.”", line: "She tells the Warden she has decided to bring the sleepers home. The Warden bows, and becomes snow, and the deepest record melts in her hands." },
        { heart: "sword", label: "“Close the door, for good.”", line: "She tells the Warden she has decided the door must never open. It looks at her a long time, and steps aside." },
        { heart: "balance", label: "“Decide again, when I know more.”", line: "She tells it she has decided only to keep deciding. The Warden laughs, a sound like an icicle breaking, and lies down in the floor to sleep." },
        { heart: "slaughter", label: "“Take the door's power before he does.”", line: "She tells it she will take whatever is behind the door. The Warden shatters, and the record melts anyway, and the cold it leaves in her does not go away." },
      ],
      victory: "The deepest record melts: “The founder of the Ten Halls built a door to heaven in the Hall of the Void, to pass the tribulation by. It opens for whoever feeds it void-born breath. Ning Wuhen has sealed it, and himself inside it, to keep it shut.”",
    },
  },
  // ------------------------------------------------------------------------------------------------ IX · life and death
  {
    dao: "lifedeath",
    title: "The Ward of Long Sleep",
    hanzi: "长眠之馆",
    level: 14,
    teacher: "wd-hm-lifedeath",
    beats: [
      {
        step: 0,
        npc: "wd-hm-lifedeath",
        title: "The Sleepers",
        objective: "A sleeping sickness has come to the Outer Court. Your ninth year belongs to the Ward of Long Sleep: report to Hall Master Wen Ru.",
        lines: [
          ["wd-hm-lifedeath", "Nineteen outer disciples have fallen asleep in the last month, and none of them will wake. Their hearts beat. Their breath goes out. It does not all come back."],
          ["wd-hm-lifedeath", "Their breath is going somewhere, Lin Yue. I have been a healer for eighty years, and I have never seen breath go somewhere."],
        ],
        done: "Nineteen sleepers lie in rows in the Ward of Long Sleep.",
      },
      {
        step: 10,
        npc: "wd-tieniu",
        title: "Shen Bai Sleeps",
        objective: "Something has happened to Shen Bai at breakfast. Tie Niu is in Room Seven.",
        lines: [
          ["wd-tieniu", "He put his head down on the table, over his porridge. Like he does when he's tired. He didn't lift it up."],
          ["wd-tieniu", "He's in the Ward now. Twentieth bed. I carried him. He weighs nothing. He used to weigh like a sack of rice."],
        ],
        done: "Shen Bai sleeps in the twentieth bed of the Ward of Long Sleep, with his sword-hoe propped beside him.",
      },
      {
        step: 20,
        npc: "wd-hm-lifedeath",
        title: "The Lotus and the Mud",
        objective: "Wen Ru needs a decision from you at the Ward of Long Sleep.",
        lines: [
          ["wd-hm-lifedeath", "I have three doses of the only draught that slows it. Twenty sleepers. The draught buys a month, no more. I cannot choose. You are the one who keeps finding things. Choose for me."],
        ],
        choice: {
          prompt: "Three doses. Twenty sleepers.",
          options: [
            { heart: "mercy", label: "Divide the doses among all twenty", then: "She divides the three doses into twenty, knowing each will buy only days.", reply: ["wd-hm-lifedeath", "Days for everyone instead of a month for three. I would have done the same, and I would have been wrong in the same way."] },
            { heart: "balance", label: "Give them to the three who sleep deepest", then: "She gives them to the three closest to the edge.", reply: ["wd-hm-lifedeath", "The lotus grows from the mud. Some of the mud is grief. You have chosen well and it will still hurt."] },
            { heart: "sword", label: "Keep them; cure it at the root instead", then: "She tells Wen Ru to keep the doses: they will find the root and cut it.", reply: ["wd-hm-lifedeath", "A gamble with twenty lives. Then go quickly."] },
            { heart: "slaughter", label: "Give one to Shen Bai first", then: "She gives the first dose to Shen Bai without a word.", reply: ["wd-hm-lifedeath", "…Love is not fair. Nor is healing. I won't pretend I don't understand."] },
          ],
        },
        done: "The doses are given. The clock is running.",
      },
      {
        step: 30,
        npc: "wd-qiu",
        title: "Qiu Keeps Watch",
        objective: "Little Qiu wants to sit with Shen Bai all night. Talk to him in Room Seven.",
        lines: [
          ["wd-qiu", "Wen Ru says sleepers sometimes hear. I want to read to him. The frog record. He liked the frog record."],
          ["wd-qiu", "Feng would want me to. I couldn't sit with Feng. I can sit with Shen Bai."],
        ],
        choice: {
          prompt: "Qiu wants to keep watch in the Ward.",
          options: [
            { heart: "mercy", label: "Sit with him, and take turns reading", then: "They read the frog record to Shen Bai in turns all night. Once, in the middle of the night, Shen Bai smiles.", reply: ["wd-qiu", "He smiled. He SMILED. He can hear."], effect: quiet(2) },
            { heart: "balance", label: "Let him, and sleep yourself", then: "She lets him keep watch and makes herself sleep, because one of them must be strong tomorrow.", reply: ["wd-qiu", "Go to sleep. I've got him. I'm staff."] },
            { heart: "sword", label: "Send him to bed; you'll watch", then: "She sends Qiu to bed and keeps the watch herself, sword on her knees.", reply: ["wd-qiu", "Fine. But wake me if he wakes. First thing."] },
            { heart: "slaughter", label: "Tell him reading won't help", then: "She tells him to save his breath.", reply: ["wd-qiu", "Then I'll waste it. It's mine to waste."] },
          ],
        },
        done: "Someone from Room Seven sits with Shen Bai every hour of every night.",
      },
      {
        step: 40,
        npc: "wd-yaozhi",
        title: "Essence Pills in the Court",
        objective: "Yao Zhi has found something in the Outer Court. She is in Room Seven, pale with anger.",
        lines: [
          ["wd-yaozhi", "Hou Er was selling pills behind the latrines. Essence Pills. 'Cultivation in a mouthful.' He had a sack of them, from his master's uncle's man. Murong Hong's agent."],
          ["wd-yaozhi", "I bought one and gave it to Wen Ru. She ground it under a glass. There's breath in it. Lin Yue, it's Shen Bai's breath. She said it smells of hay and porridge."],
          ["wd-yaozhi", "And at the heart of every pill, a crumb of void-stone to hold the breath in. The same stone that was in furnace nine. They were pressing pills in the Red Furnace at night, and the stones starved it. That's why it burst."],
        ],
        done: "The Essence Pills are made of the sleepers' breath, and some are made of Shen Bai's.",
      },
      {
        step: 60,
        npc: "wd-hm-lifedeath",
        title: "Cut the Root",
        objective: "Wen Ru has worked out the cure. Hear it at the Ward of Long Sleep.",
        lines: [
          ["wd-hm-lifedeath", "Every pill draws the breath of a sleeper into whoever swallows it. The sleepers will not wake while the pills are being eaten. Burn the pills, stop the buying, and the breath comes home."],
          ["wd-hm-lifedeath", "And the one making them is the one who must stop. The root. Murong Hong."],
        ],
        done: "Cut the root, and the breath comes home.",
      },
      {
        step: 70,
        npc: "wd-murong",
        title: "Blood or Brothers",
        objective: "Murong Xiao knows what his uncle has done. He is by the ring, alone.",
        lines: [
          ["wd-murong", "He bought me sweets. He taught me to ride. He paid for everything I ever had, and it was paid for with this. With sleeping people."],
          ["wd-murong", "He's coming to the court tomorrow, to the east gate, with a cart. I could warn him. I could stand beside him. I could stand beside you."],
        ],
        choice: {
          prompt: "Murong Xiao is choosing between his blood and his friends.",
          options: [
            { heart: "mercy", label: "“Whatever you choose, you have a seat at our table.”", then: "She tells him Room Seven's bench will be there either way.", reply: ["wd-murong", "…Then I choose the bench. I'll stand at the gate with you."] },
            { heart: "balance", label: "“Stand there, and let him see you.”", then: "She tells him the hardest thing his uncle can face is his nephew's face.", reply: ["wd-murong", "Let him see me. Yes. Let him see what he paid for."] },
            { heart: "sword", label: "“Stand beside me.”", then: "She asks him plainly.", reply: ["wd-murong", "Beside you. With a sword, for once, instead of a name."] },
            { heart: "slaughter", label: "“Warn him and I'll know which you chose.”", then: "She tells him she will be watching which way he runs.", reply: ["wd-murong", "You never trust anyone, do you? Fine. Watch. I'll be at the gate."] },
          ],
        },
        done: "Murong Xiao will be at the east gate, beside Room Seven.",
      },
      {
        step: 80,
        npc: "wd-hm-lifedeath",
        title: "The Last Dose",
        objective: "Wen Ru has something for you at the Ward of Long Sleep.",
        lines: [
          ["wd-hm-lifedeath", "This is the last dose. I kept it back. It is for you, if you fall asleep at the gate tomorrow. You have the void in you too."],
          ["wd-hm-lifedeath", "Life and death are one road walked in two directions. Walk it the right way tomorrow."],
          { a: "hero", n: "bow" },
        ],
        done: "A last dose, in a jade vial, at her belt.",
      },
      {
        step: 90,
        npc: "wd-murong",
        title: "At the Gate",
        objective: "Murong Hong's cart is coming up the road to the east gate. Murong Xiao is waiting by the ring.",
        lines: [
          ["wd-murong", "That's his cart. Silk awning, gold tassels. He always did like to be seen. Today he'll be seen."],
          ["wd-murong", "Uncle doesn't fight. Uncle pays people to fight. But he's been eating his own pills for years. I don't know what he is now."],
        ],
        done: "Murong Hong's cart stands outside the east gate, piled with sacks of pills.",
      },
      {
        step: 98,
        npc: "wd-hm-lifedeath",
        title: "Go",
        objective: "Wen Ru is standing in the Ward of Long Sleep's door, watching the gate.",
        lines: [
          ["wd-hm-lifedeath", "Go. I'll keep the sleepers breathing until you come back. Come back."],
        ],
        done: "Murong Hong waits outside the east gate, swollen with stolen breath.",
      },
    ],
    lectures: [
      "Every herb that heals can kill. The difference is the dose, and the heart.",
      "A seed has to stop being a seed. That is the price of a tree.",
      "The dead do not frighten me. The ones who will not die, and the ones who will not let others live, frighten me.",
      "Monks say let go. Mothers say hold on. Both are right, at different hours.",
      "Being born is the first step toward dying. Nobody holds it against the baby.",
      "A candle lives by burning. Stop the burning and you do not get a long-lived candle. You get wax.",
    ],
    roommates: {
      "wd-yaozhi": ["I've sold my best hairpins to buy every Essence Pill Hou Er has left. Then I burned them. Best money I ever spent.", "Murong sits in the Ward with Shen Bai when he thinks nobody's looking. I'm always looking."],
      "wd-tieniu": ["I carry water to the Ward every hour. Wen Ru says sleepers need damp air. I'd carry the river if she asked.", "Shen Bai's bunk is empty. I keep putting his hoe back on it."],
      "wd-meilan": ["The sleepers' breath goes into the pills. But some of it goes somewhere else too. Toward the corner of the court.", "My grandfather is holding a door. I think the sleepers are behind it too, in a way. Their breath is."],
      "wd-qiu": ["I read the frog record to Shen Bai forty times. He smiled twice. I counted.", "Wen Ru says I've got good hands for nursing. I said I'm staff. She said staff can nurse."],
    },
    boss: {
      intro: "Murong Hong steps down from his cart. Under the silk he is swollen and grey, and when he breathes out, it is many breaths at once.",
      words: [["wd-hong", "Do you know what it is to feel twenty again every month, girl? The Examiner gives me breath and I give him gold. Everyone is happy except the ones asleep, and they never complain."]],
      fates: [
        { heart: "mercy", label: "Draw the stolen breath out of him gently", line: "She lays a hand on his chest and draws the stolen breath out of him one sleeper at a time, and sends each home. When she is done he is an old man in a silk robe, weeping, and alive." },
        { heart: "sword", label: "Cut the cord of stolen breath", line: "She cuts once, through the grey threads of breath that run out of him toward the Ward, and they snap and fly home like startled birds. Murong Hong falls to his knees, empty." },
        { heart: "balance", label: "Give the breath back to the sleepers, and him to the magistrate", line: "She sends the breath home and binds him for the magistrate of Jinhe, with Yao Zhi's uncle's letter tucked in his sleeve." },
        { heart: "slaughter", label: "Take the breath for yourself", line: "She breathes in, and the stolen breath pours out of Murong Hong into her. For a moment she feels twenty lives at once. Then she breathes out, and some of it does not go home." },
      ],
      victory: "In the Ward of Long Sleep, twenty sleepers sit up at once. Shen Bai rubs his eyes, looks round, and asks whether he has missed breakfast. Tie Niu picks him up and will not put him down.",
    },
  },
  // ------------------------------------------------------------------------------------------------ X · void
  {
    dao: "void",
    title: "The Gate Within the Gate",
    hanzi: "门中之门",
    level: 16,
    teacher: "wd-hm-water",
    beats: [
      {
        step: 0,
        npc: "wd-fanyu",
        title: "Mei Lan Goes Home",
        objective: "Senior Sister Fan Yu has the morning register at the Mission Hall. Something is wrong.",
        lines: [
          ["wd-fanyu", "'Outer Disciple Mei Lan, Room Seven, has gone home.' Signed Yan Shu, at dawn."],
          ["wd-fanyu", "Her brushes are still on her bunk. Mei Lan would never leave her brushes. This time we don't wait, Lin Yue. This time we go and get her."],
        ],
        done: "Mei Lan's bunk is empty, and her brushes are still on it.",
      },
      {
        step: 10,
        npc: "wd-hm-ice",
        title: "Council of the Halls",
        objective: "The Hall Masters have gathered in the Library of Frozen Words. Han Shuang will speak for you.",
        lines: [
          ["wd-hm-ice", "Nine masters in one room for the first time in sixty years. I showed them the deepest record. The Examiner says the Sect Master in his seclusion has ordered silence on the matter."],
          ["wd-hm-ice", "Nobody has seen the Sect Master in six years. Only Yan Shu goes in and out of his chamber. I think it is time someone else did."],
        ],
        done: "The Hall Masters want to see the Sect Master with their own eyes.",
      },
      {
        step: 20,
        npc: "wd-gou",
        title: "The Empty Chamber",
        objective: "Steward Gou keeps every key in the court. Ask him for the Sect Master's.",
        lines: [
          ["wd-gou", "The seclusion chamber. I've had the key forty years and never once used it. Come on, then."],
          ["narr", "The Sect Master's chamber is clean, and empty, and has been empty a long time. The cushion is cold. The incense burned out years ago. On the table lies the Sect Master's seal, and beside it, the Examiner's brush."],
          ["wd-gou", "He's been ruling in a dead man's name. Or a gone one's. Six years."],
        ],
        done: "The Sect Master is gone, and Yan Shu has been ruling with his seal.",
      },
      {
        step: 30,
        npc: "wd-hm-water",
        title: "A Door to Heaven",
        objective: "Hall Master Lan Yi, eldest of the masters, will tell you what she knows, at the Hall of Still Water.",
        lines: [
          ["wd-hm-water", "The founder of the Ten Halls was afraid of the tribulation. So she built a door, in the Hall of the Void, that would let a cultivator step past heaven's lightning altogether. It needs breath to open, the breath of the void-born. A great deal of it."],
          ["wd-hm-water", "She never used it. She was ashamed of it. Ning Wuhen found it, sixty years ago, when his disciple Yan Shu tried to open it with the breath of a sleeping first-year. Ning sealed the door, and went in after the boy, and held it shut. We all thought he died."],
          ["wd-hm-water", "Yan Shu has been feeding it ever since, one void-born disciple every Selection, waiting for Ning to tire. And now he has Ning's own blood. Mei Lan can unmake her grandfather's seal from the inside."],
        ],
        done: "A door to heaven, a master who held it for sixty years, and a disciple who never stopped feeding it.",
      },
      {
        step: 40,
        npc: "wd-hm-earth",
        title: "Ten Seals",
        objective: "The Hall Masters are waiting for you at the Hall of Bearing.",
        lines: [
          ["narr", "The Sealed Hall can only be opened with the seal of every hall. One by one, the masters put theirs in her hands: Still Water, the Old Pine, No Walls, the Red Furnace, Bearing, the Edge, Discipline, the Frozen Words, Long Sleep. Nine seals. The tenth is the Void's own, and it is in the Sect Master's chamber, by the Examiner's brush."],
          ["wd-hm-earth", "“Go.”"],
          { a: "hero", n: "token" },
        ],
        done: "Ten seals, in her hands.",
      },
      {
        step: 60,
        npc: "wd-qiu",
        title: "Not Without Me",
        objective: "Little Qiu is waiting in Room Seven with his brother's sword.",
        lines: [
          ["wd-qiu", "My brother is behind that door. I'm coming. I'm fifteen now. Nearly. Don't say I'm too small. I'm the right size for doors."],
        ],
        choice: {
          prompt: "Qiu will not be left behind.",
          options: [
            { heart: "mercy", label: "“Then stay close behind me.”", then: "She tells him to keep one hand on her sash the whole way.", reply: ["wd-qiu", "First. You go first. I'm right behind."] },
            { heart: "balance", label: "“Guard the outer door. Someone must.”", then: "She gives him the most important job: to hold the way out.", reply: ["wd-qiu", "Hold the way out. Like Ning. I can do that."] },
            { heart: "sword", label: "“Bring the sword. He'll want it.”", then: "She tells him to bring the sword, so his brother can collect it.", reply: ["wd-qiu", "Until. Jin Ge said until. It's until today."] },
            { heart: "slaughter", label: "Lock him in Room Seven", then: "She locks him in. He hammers on the door until his fists bleed.", reply: ["wd-qiu", "LET ME OUT. LIN YUE. HE'S MY BROTHER."], effect: feed(3) },
          ],
        },
        done: "Little Qiu is ready, his brother's sword across his back.",
      },
      {
        step: 70,
        npc: "wd-tieniu",
        title: "Room Seven Goes to War",
        objective: "Room Seven is gathering. Meet them in the dormitory.",
        lines: [
          ["wd-tieniu", "I'll carry anyone who falls. In and out. However many."],
          ["wd-shenbai", "I owe the sleepers my breath. I'm bringing the hoe."],
          ["wd-yaozhi", "I've written my will. It's very short and very rude. Let's go."],
          ["wd-qiu", "Feng's sword. Mei Lan's brushes. I'm bringing both."],
          ["narr", "Outside the door, Murong Xiao is waiting with a sword he forged himself, and behind him, half the east row."],
          { a: "wd-tieniu", n: "salute" },
        ],
        done: "Room Seven is going to war, and half the Outer Court is going with it.",
      },
      {
        step: 80,
        npc: "wd-gou",
        title: "Steward Gou's Confession",
        objective: "Steward Gou is standing outside the dormitories with a lantern, waiting for you.",
        lines: [
          ["wd-gou", "Sixty years ago I was a first-year in Room Seven. So was a quiet boy with no family and a stone that had shown it something clear. Yan Shu."],
          ["wd-gou", "Ning Wuhen took him as his disciple. Then one night the boy found the door, and found he could open it, if he fed it someone else. He chose the boy in the bunk by the window. Ning came in time. Sealed it. Went in after the sleeper."],
          ["wd-gou", "The boy in the bunk by the window was me. Ning held the door shut behind me and sent me back out. I've been a steward forty years so I could count the row every night. I counted wrong eleven times."],
        ],
        done: "Steward Gou was the first sleeper, and the only one Ning sent home.",
      },
      {
        step: 90,
        npc: "wd-hm-water",
        title: "The Sealed Hall Opens",
        objective: "Bring the ten seals to the Sealed Hall of the Void, where Lan Yi is waiting.",
        lines: [
          ["narr", "Ten seals in ten hollows. The chains on the Sealed Hall of the Void slide loose, and the door opens on nothing: not dark, not light, a room that goes on further than the court is wide."],
          ["narr", "At the far end of it is a round door carved with a closed eye, and in front of the door, sitting cross-legged in the nothing with both hands flat against the stone, is an old man who has not moved in sixty years."],
          ["wd-hm-water", "…Ning. Oh, Ning."],
        ],
        done: "The Sealed Hall of the Void is open, and Ning Wuhen is in it, holding the door.",
      },
      {
        step: 98,
        npc: "wd-ning",
        title: "Ning Wuhen",
        objective: "Speak with Ning Wuhen at the door within the Sealed Hall of the Void.",
        lines: [
          ["wd-ning", "Sixty years. Is it sixty? It feels like an afternoon. Behind me they sleep: my granddaughter, and Qiu Feng, and Lu Ping, and all the rest. Their breath has been going into the door, and I have been holding it shut with mine."],
          ["wd-ning", "Mei Lan was meant to open my seal from inside. She refused. She sat down beside me and held the door too. She is very like her grandmother."],
          ["wd-ning", "He is here, girl. He has been here the whole time. He is very tired of waiting."],
        ],
        done: "Yan Shu steps out of the nothing behind them, with the Sect Master's seal in his hand.",
      },
    ],
    lectures: [
      "The bowl is useful for the emptiness in it. So is the house. So is the heart.",
      "Fear being full of nothing but yourself, not being empty.",
      "The empty squares of the xiangqi board are where the game is.",
      "Ning used to say the void is not nothing. It is room.",
      "When the tide goes out you see what was always there. Mostly mud. And pearls.",
      "A door is only a door because of the hole in the wall. Remember what you are opening.",
    ],
    roommates: {
      "wd-shenbai": ["I slept a whole season and dreamed of a door with an eye on it. I think I saw Mei Lan's grandfather in it. He waved.", "I'm bringing my hoe. Doors are just very stubborn soil."],
      "wd-yaozhi": ["I've sent Murong Hong's ledger to every magistrate in the south. The Murongs are finished. I didn't even have to marry anyone.", "Mei Lan's bunk is cold. I put my silk pillowcase on it. For when she comes back."],
      "wd-tieniu": ["I've been practising carrying people out of places. I carried Qiu round the court nine times. He's furious.", "Hou Tu said three words to me yesterday. 'Bring them home.'"],
      "wd-qiu": ["Fifteen. Nearly. That's old enough for doors.", "Feng's sword has a frog on the hilt and his name on the blade. He'll laugh so hard."],
    },
    boss: {
      intro: "Yan Shu, the Examiner, walks out of the nothing. He has kept his lovely handwriting and nothing else; he is thin as paper, and his eyes are full of the void.",
      words: [
        ["wd-yanshu", "The stone showed me you, Lin Yue. The brightest void-born in a thousand years. Your founder slept in your bunk and showed the stone the same thing, did you know? One breath of yours and the door opens, and I walk past heaven without a single bolt."],
        ["wd-yanshu", "Sixty years I have waited for him to tire. Step aside, Ning. Step aside, girl. Everyone the seal says goes home."],
      ],
      fates: [
        { heart: "mercy", label: "Ask Ning to take him back as his disciple", line: "She steps back, and Ning Wuhen, very slowly, stands up for the first time in sixty years, and holds out his hand to his disciple. Yan Shu stares at it. Then he kneels in the nothing and weeps like a boy in a cold bunk." },
        { heart: "sword", label: "Give him a cultivator's death", line: "She gives him a clean death, the death of a cultivator, and the breath he stole from eleven Selections pours out of him like birds out of a cage and flies home through the open door of the hall." },
        { heart: "balance", label: "Seal the door, and leave him outside it, a mortal", line: "She draws the void out of him and gives it back to the hall, and lays her ten seals on the door, and it closes forever. Yan Shu is only a man when she is done: a thin old mortal with lovely handwriting. Steward Gou gives him a broom." },
        { heart: "slaughter", label: "Feed him to the door he wanted", line: "She opens the door, just a crack, and puts Yan Shu through it. It closes behind him with a sound like a swallow. Whether he passed heaven by, or simply ended, no one will ever know." },
      ],
      victory: "Behind Ning Wuhen the sleepers wake: Mei Lan with ink still on her fingers, Lu Ping, a dozen others, and a young man with big feet who blinks at Little Qiu and says, “You've got my sword.” The Sealed Hall of the Void has a master again.",
    },
  },
];
