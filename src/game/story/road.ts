import { cultivationNeeded, levelIndex, realmLabel, REALMS } from "../engine/realms";
import { gainCultivation, heal, type GameState } from "../engine/state";
import { DAOS, dominantDao, walkDao, type DaoId } from "../engine/dao";
import { comprehend, GREAT_DAOS, WU_TIERS, wuCap, wuTier, type GreatDaoId } from "../engine/comprehension";
import { CULT, shift } from "../engine/cultivation";
import { ENEMIES, isHollow, type EnemyId, type HollowId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import type { AreaId } from "../world/ids";
import { echoOf, ROAD_DAOS, ROAD_SITES, steleKey, tideFolk } from "../world/road";
import { FOLK, SIGHTS } from "./bounties";
import type { Choice, Step } from "./script";
import { giveAttire } from "./wardrobe";
import { originOf } from "./origins";

/**
 * The Founder's Road (问道): the fourth thread of the main tale, a thousand
 * quests long.
 *
 * Before Lian Qingxue, the Azure Cloud's founder, went up to heaven she
 * walked the jianghu for ten years, and at ten places she understood one of
 * the Great Daos of heaven and earth and carved what she understood into a
 * stele: the Canon of Clear Snow (清雪道藏). For a thousand years the steles
 * stood, and cultivators came to read them. Now someone is eating them.
 *
 * Wei Kongming was born unable to feel the Dao. No stele ever spoke to him,
 * no shrine, no master. So he learned to do what no one should: to swallow a
 * Dao whole instead of understanding it. Every stele he empties leaves the
 * land around it without that Dao (water that will not flow, fire that will
 * not warm, wind that does not move the grass), and something hollow stands
 * guard where the verse was. He is also the man who taught a steppe chieftain
 * named Tuoba Hong that a demon beast's core could be eaten.
 *
 * Daoist Qingxu, an old wanderer who has copied the founder's steles all his
 * life, asks the Azure Cloud's disciple to walk the Road behind the Dao-Eater
 * and mend it, stele by stele: ten books of a hundred quests, one for each
 * Great Dao. Every quest asks a realm of her, as the war does; along the way
 * she sits where each Dao runs strong, watches it at work in the world, asks
 * the folk of the jianghu what it means to them, faces the hollowed who
 * follow the Dao-Eater, and answers the Road's questions. What she
 * understands she keeps (see engine/comprehension.ts). At each stele's end
 * she faces its Hollow Echo, and decides what becomes of the Dao it wore:
 * set it free, cut it apart, give it back to the land, or eat it herself.
 *
 * Every quest is composed from its number, so the save holds only how many
 * are done (`road`) and how far the current one has got (`roadp`). The flags
 * the land answers to are derived from those (see syncRoadFlags).
 */

export const ROAD_COUNT = 1000;
export const ROAD_BOOK = 100;

export type RoadKind = "seek" | "contemplate" | "observe" | "ask" | "trial" | "koan" | "comprehend" | "stele" | "echo";

export interface RoadQuest {
  id: number;
  book: number;
  step: number;
  dao: GreatDaoId;
  kind: RoadKind;
  title: string;
  /** The journal line. */
  objective: string;
  /** What she is told when it is set. */
  brief: string;
  /** Who she must speak to (seek, ask, koan, stele). */
  npc?: string;
  /** How many (contemplate, trial). */
  count: number;
  /** Where (observe): a landmark, and how she must be there. */
  landmark?: string;
  how?: "any" | "night" | "day" | "ride" | "fly";
  /** Where (contemplate): the land whose shrine she must sit at. */
  region?: AreaId;
  /** Which question (koan). */
  koan?: number;
  /** The hollowed she must face (trial). */
  foe?: HollowId;
  /** The realm the Road asks of her for this quest (an overall level index). */
  level: number;
  /** Said or narrated when it is done. */
  done: string;
  /** How far nearer the book's Great Dao it brings her. */
  wu: number;
  reward: { stones: number; cult: number };
}

// ----------------------------------------------------------------------------- the books
interface BookInfo {
  title: string;
  hanzi: string;
  /** Where the stele stands, in words. */
  place: string;
  /** The overall level the Road asks of her when the book opens. */
  level: number;
  /** Folk who are always there to be asked what the Dao means to them. */
  folk: string[];
  /** Landmarks where the Dao can be watched at work (the stele itself is always one). */
  sights: string[];
  /** Lands whose shrines run strong with the Dao. */
  shrines: AreaId[];
  /** What Qingxu says when he meets her at the stele. */
  keeper: string;
  /** What the land has lost, narrated as the book opens. */
  hollowing: string;
  /** The founder's verse, read from the mended stele. */
  verse: string;
  /** The land when the Dao comes home. */
  victory: string;
  /** The land when she eats the Dao instead. */
  devoured: string;
}

export const BOOKS: Record<GreatDaoId, BookInfo> = {
  water: {
    title: "The Pond That Forgot the Rain",
    hanzi: "忘雨之池",
    place: "the watermill by the Lotus Lake",
    level: 4,
    folk: ["wen", "tang", "rong"],
    sights: ["mill", "orchard"],
    shrines: ["lake", "harbor"],
    keeper:
      "You are the Azure Cloud's girl? Good. I am Qingxu. I have spent sixty years copying your founder's steles, and last month I came here to copy this one for the ninth time and found it empty. Not broken. Empty. Look at the millrace.",
    hollowing: "The millrace below the stele has stopped. Not frozen, not dammed: the water simply lies there, as if it had forgotten which way was down. The waterwheel creaks and does not turn.",
    verse: "“Nothing under heaven is softer than water, and nothing wears the hard and strong so well. The low place is not a defeat. It is where everything comes home.”",
    victory: "The millrace remembers itself with a gulp and a rush. The wheel turns, Miller Tang shouts, and the lotus beds sway as the lake breathes out.",
    devoured: "The water stays still. It will always be still now. The fish learn to live in it, the way people learn to live in a house where someone has died.",
  },
  wood: {
    title: "The Grove That Stopped Growing",
    hanzi: "止生之林",
    place: "the bamboo by the Moon-Gazing Pavilion",
    level: 5,
    folk: ["fang", "ou", "ba", "hua"],
    sights: ["pavilion", "teahouse", "swordtomb"],
    shrines: ["bamboo", "village"],
    keeper: "The second stele, and he was here before us again. Touch the bamboo, disciple. It is green, and it is dead. It has stopped growing, and it does not know it.",
    hollowing: "Round the stele the bamboo stands green and silent. Not a shoot has pushed up since the Dao-Eater passed. The foxes have left. Even the mould will not touch the fallen leaves.",
    verse: "“The bamboo bends to the storm and is standing when the storm has gone. Growing is not getting bigger. Growing is not stopping.”",
    victory: "Something cracks in the earth: a hundred shoots at once, pushing up through the dead leaves. By evening Auntie Fang is complaining about the noise.",
    devoured: "The grove stays green and never grows again. In a hundred years it will look exactly as it does today. Travellers think it beautiful. The foxes never come back.",
  },
  wind: {
    title: "The Steppe Without Breath",
    hanzi: "无息之原",
    place: "the herders' camp on the eastern steppe",
    level: 7,
    folk: ["herder", "oyun", "gao", "alan", "hai"],
    sights: ["steppe", "rainbow", "lodge"],
    shrines: ["sect", "harbor"],
    keeper: "Out here the wind has blown since the world was made. Listen. Nothing. The herders say their prayer flags have hung straight down for a month. They say it is an omen. It is a theft.",
    hollowing: "The grass of the steppe stands upright and still as far as the eye goes. The prayer flags hang like wet washing. The herders' horses keep lifting their heads to sniff a wind that is not there.",
    verse: "“The wind is never seen, only what it moves: the grass, the sail, the hair of a child. Be like it. Let them know you by what you set going.”",
    victory: "The wind comes back all at once, from every side, and knocks Herder Altan's hat off. The prayer flags crack like whips. Every horse on the steppe starts running at once, for joy.",
    devoured: "The steppe keeps its stillness. The herders move their camp south, where the grass still talks. The flags they leave behind hang straight down forever.",
  },
  fire: {
    title: "The Cold Flame",
    hanzi: "寒焰",
    place: "the red cliffs of the badlands",
    level: 8,
    folk: ["batu", "saran", "temur", "caravaneer", "yanhuo", "phxchi", "minerWei"],
    sights: ["redcliff", "phoenix"],
    shrines: ["desert", "valley"],
    keeper: "Fire, here, of all places. Feel this campfire. It burns, and it gives nothing. He took the part of fire that gives. The Phoenix disciples are terrified; their own flames have started going grey at the edges.",
    hollowing: "The fires round the red cliffs burn grey and give no heat. The caravaneers sit round them shivering in the desert night, staring at flames that have kept everything for themselves.",
    verse: "“Fire keeps nothing for itself. It gives its heat away until there is no fire left, and that is why it is never cold. Burn so.”",
    victory: "The grey flames blush orange, then gold, then throw out such a heat that everyone round them laughs and pulls back. Yan Huo says the Phoenix's own fire has never burned so clean.",
    devoured: "The fires of the badlands stay grey. They still cook food. They do not warm hands. The nomads stop telling stories round them.",
  },
  earth: {
    title: "The Mountain That Let Go",
    hanzi: "弃负之山",
    place: "the foot of the Dragonspine",
    level: 10,
    folk: ["dong", "wu", "niu", "cui", "luyu", "zhou", "liu"],
    sights: ["dragonspine", "pagoda", "spring", "bandits"],
    shrines: ["terraces", "village"],
    keeper: "Earth is the Dao of carrying. It carries the mountain and the grave and asks nothing. He has taken it from the Dragonspine. Look at the scree. The mountain is putting things down.",
    hollowing: "Stones slide down the Dragonspine's flank in a slow, endless trickle. Terrace walls slump. The earth here has stopped holding things up, the way a tired man stops holding a load.",
    verse: "“The earth carries the mountain and the grave alike and complains of neither. To be the ground under others is not to be beneath them.”",
    victory: "The scree stops sliding. The mountain settles back into itself with a long sigh that everyone on the terraces feels in their feet. Prospector Dong swears the Dragonspine just stood up straighter.",
    devoured: "The Dragonspine keeps letting go, a stone at a time. Nobody builds terraces on its flank any more. In a thousand years it will be a hill.",
  },
  metal: {
    title: "The Edge That Gave Up",
    hanzi: "钝锋",
    place: "the Sword Tomb in the westwood",
    level: 11,
    folk: ["ou", "han", "fang", "tangyu"],
    sights: ["swordtomb", "pavilion", "teahouse"],
    shrines: ["bamboo", "frost"],
    keeper: "Smith Ou told me before I could tell him. Every blade on his hill went dull in one night. Not rusted: dull, as if each one had forgotten what it agreed to be. Metal is the Dao of keeping a shape. He has taken it.",
    hollowing: "Every sword in the Sword Tomb has gone dull overnight, the edges soft as lead. Smith Ou's hammer rings dead on the anvil. Even the nails in the old shed are bending.",
    verse: "“The edge is only the shape the metal agreed to keep. Keep your word as the blade keeps its edge: quietly, and every day.”",
    victory: "A sound runs along the Sword Tomb's hill like a thousand blades leaving their sheaths at once. Every edge is bright again. Smith Ou weeps and pretends it is the forge smoke.",
    devoured: "The Sword Tomb's blades stay dull. Smith Ou keeps them anyway. A blunt sword, he says, is still somebody's sword.",
  },
  thunder: {
    title: "The Silent Storm",
    hanzi: "无声之雷",
    place: "the pagoda hill above the scarecrow fields",
    level: 13,
    folk: ["luyu", "cui2", "han", "wu", "qiu", "elder"],
    sights: ["pagoda", "spring", "terraces-sect"],
    shrines: ["terraces", "sect"],
    keeper: "Lightning struck the pagoda three nights running, and not one of the seven lamps heard it. Thunder is heaven's voice. He has taken the voice and left the anger. That is the most dangerous thing he has done yet.",
    hollowing: "Storms gather over the pagoda hill and break in perfect silence. The lightning strikes and strikes, and nobody hears it, and the rain falls without a whisper, and the people of the fields have started to whisper too.",
    verse: "“Heaven's anger lasts an instant. Its patience lasts forever. Strike once, and be sure. Then be silent a long time.”",
    victory: "The next bolt that falls on the pagoda hill is so loud that every scarecrow in the fields falls over. The farmers cheer. Sister Ming says her lamps flickered for the first time in forty years.",
    devoured: "The storms over the hill stay silent. The lightning still falls. People die of it now, because nobody hears it coming.",
  },
  ice: {
    title: "The Winter That Would Not End",
    hanzi: "不解之冬",
    place: "the Sword Sea crag above Frostveil",
    level: 14,
    folk: ["xuan", "tuo", "novice-1", "novice-2", "novice-3", "lingfeng", "rubing", "tangyu"],
    sights: ["swordsea"],
    shrines: ["frost", "peak"],
    keeper: "You would think ice would be the one Dao he could not take from Frostveil. He did not take the cold. He took the deciding. Ice is water that has decided. Look at the snow: it cannot decide whether to fall.",
    hollowing: "Snow hangs in the air over the Sword Sea crag, flakes neither falling nor rising. Icicles drip upward and freeze again. The monks say their prayers come out of their mouths and do not know where to go.",
    verse: "“Ice is water that has decided. Decide, and hold, and when the spring comes, decide again. That is not weakness. That is the year.”",
    victory: "The hanging snow falls all at once, a soft white curtain, and lies down properly on the crag. Abbot Xuan laughs out loud, which nobody in Frostveil has heard him do.",
    devoured: "The snow above the crag hangs where it is, undecided, forever. The monks call it the Pavilion of Indecision. Disciples go there to learn what not to become.",
  },
  lifedeath: {
    title: "Neither Living Nor Dead",
    hanzi: "不生不死",
    place: "Hundred Herb Valley",
    level: 16,
    folk: ["ye", "kong", "baizhi", "linger", "herbHan", "yan", "innkeeper"],
    sights: ["herbvalley", "temple", "camp", "plum"],
    shrines: ["marsh", "valley"],
    keeper: "Here he took the Dao that holds the other eight together. Bai Zhi's herbs bloom and rot in an hour and bloom again. Nothing in this valley can live, and nothing can die. I have never been so frightened.",
    hollowing: "In Hundred Herb Valley the flowers open and wither and open again in the space of a breath. A sparrow that fell last week still lies twitching on the path. Bai Zhi has stopped picking anything.",
    verse: "“The lotus grows from the mud of everything that died before it. Do not hate the mud. Do not cling to the flower. Both are the lotus.”",
    victory: "The sparrow on the path is still at last. Beside it a seed splits. The valley breathes in, and things begin to die properly, and to be born properly, and Bai Zhi kneels in the herb beds and laughs.",
    devoured: "Hundred Herb Valley stays as it is: blooming and rotting, blooming and rotting. Bai Zhi's sect leaves for the south. Some say the valley is immortal now. Nobody wants to live there.",
  },
  void: {
    title: "The Bowl at the End of the World",
    hanzi: "世尽之钵",
    place: "Returning Cloud Isle, off the port of Hailing",
    level: 17,
    folk: ["hlharbor", "hlmonk", "hlshrine", "hlpuppeteer", "hlchess1", "hlpearl", "hlboatwoman", "hlsalt"],
    sights: ["hailing", "saltwind"],
    shrines: ["harbor", "frost"],
    keeper: "The last stele. The founder carved it on the isle at the edge of the sea, the morning she went up. He is there, disciple. Not an Echo. Him. He ate nine Daos and poured each one into an Echo to guard its stele, and you have taken all nine back. He is emptier now than the day he was born, and he means to eat the one Dao that is nothing but emptiness, and see if that fills him.",
    hollowing: "Out on Returning Cloud Isle the sea and the sky have run into one another. There is no horizon. The tide comes in and goes out at the same moment. The people of Hailing have stopped looking east.",
    verse: "“The bowl is useful for the emptiness in it. So is the house, so is the heart. Do not fear being empty. Fear being full of nothing but yourself.”",
    victory: "The horizon comes back like a drawn breath: sea below, sky above, a line between them that every fisherman in Hailing points at and shouts about. The tide goes out properly, and the whole city goes down to the beach to watch it.",
    devoured: "The horizon over Returning Cloud Isle never comes back. Hailing's sailors navigate by the stars and the gulls now. They do not sail east.",
  },
};

// ----------------------------------------------------------------------------- the words
/** What each Dao means to the folk of the jianghu, in their own words (whoever is asked). */
const ASKS: Record<GreatDaoId, string[]> = {
  water: [
    "“Water? It goes round. Every stone in the river, it goes round. And in the end the stone is sand and the river is still a river.”",
    "“You can't hold water in a fist. You can in a cupped hand. That's all I know about it, and it's taken me fifty years.”",
    "“When my wife died I cried for a month. Then one morning I didn't. Water finds the low place, and then it's level again.”",
    "“Rain falls on the rich man's roof and the beggar's head the same. I like that about it.”",
    "“The lake looks the same every day. It's never the same water. I think about that more than I should.”",
    "“Water's patient. I'm not. That's why I fish: so it can teach me.”",
    "“Ever tried to push water? It just moves aside and closes behind your hand. Can't fight a thing like that.”",
    "“My mother said: be like water, child. Fill whatever shape they give you, and wear the shape down.”",
  ],
  wood: [
    "“Wood? Cut a tree, and next spring the stump sends up a shoot. Stubborn things, trees. I like stubborn.”",
    "“My grandfather planted the tree I'm sitting under. He never sat in its shade. Wood is for the next ones.”",
    "“Bamboo's hollow inside. Strongest thing in the forest. Make of that what you will, immortal.”",
    "“A tree doesn't hurry. Doesn't stop, either. Hurry and stop, that's people.”",
    "“Even dead wood's busy: mushrooms, beetles, the next tree. Nothing in a forest is wasted.”",
    "“You can bend a sapling into any shape. Try it with an old tree. That's the whole of raising children.”",
    "“Roots go down as far as branches go up. You never see the half that holds it.”",
    "“Spring comes every year, immortal. Every year. You'd think we'd stop being surprised.”",
  ],
  wind: [
    "“You never see the wind. You see the grass bow. That's how I know my children are well — by what they move.”",
    "“A sail doesn't fight the wind. It leans. That's sailing. That's most things.”",
    "“The wind's always leaving. It's never sad about it. I'm trying to learn that.”",
    "“On the steppe we say: a man who stands against the wind ends up lying down.”",
    "“Wind carries seeds, smoke, the smell of home. It carries everything and keeps nothing.”",
    "“My kite only flies because the string holds it back. Wind needs something to push against.”",
    "“The wind's free, they say. I don't know. It goes where the heat and the cold tell it to. Maybe that's freedom.”",
    "“Breathe in. That's wind too. You've been doing it all your life without thinking. That's the trick of it.”",
  ],
  fire: [
    "“Fire? It eats. But it eats so others can be warm. My father was like that.”",
    "“You can't keep fire. You can only keep feeding it. Same with friendship.”",
    "“A spark is nothing. Put it in dry grass and it's a forest fire. Small things aren't small.”",
    "“Fire cooks the rice and burns the house. Same fire. It's all in where you put it.”",
    "“In the desert the fire is the only friend who comes every night. You don't ask it questions.”",
    "“Burned my hand once. Never forgot. Fire teaches in one lesson.”",
    "“The phoenix burns and comes back. Most of us only get the burning.”",
    "“Look how it reaches up. Always up. Even when it's dying, it reaches up.”",
  ],
  earth: [
    "“The earth? It takes whatever you give it. Seeds, bones, rain. Gives you back rice. Fair trade.”",
    "“My knees know the earth better than I do. Forty years of planting.”",
    "“You can't hurry soil. You can only feed it and wait. Same as people.”",
    "“Everything we build, we build on it. Nobody thanks it. It doesn't seem to mind.”",
    "“A mountain doesn't go anywhere. Everything goes round it. That's strength, immortal.”",
    "“When I die they'll put me in it. I'm not afraid. It's been holding me up all my life.”",
    "“Dig anywhere and you find something old. The earth remembers what we forget.”",
    "“A terrace is just earth agreeing to be a step. Took my family ten years to talk it into it.”",
  ],
  metal: [
    "“Metal remembers every blow you give it. That's why you hit it right the first time.”",
    "“A blade is soft iron that went through fire and didn't give up. That's all a hero is.”",
    "“Bronze bells, iron ploughs, a silver hairpin. Same Dao. Different promises.”",
    "“Keep your edge, keep your word. My master said it every morning. I thought he was boring. I miss him.”",
    "“Hard isn't the same as strong. Too hard and it shatters. You want it to give a little.”",
    "“Gold doesn't rust. People think that makes it noble. I think it makes it lonely.”",
    "“You can melt a sword down and make a plough. Can't do that with a grudge.”",
    "“Every needle in my sewing box was once a rock in a mountain. Think of that.”",
  ],
  thunder: [
    "“Thunder? It scares the children and wakes the rice. Both are its job.”",
    "“You see the lightning before you hear it. Heaven acts first and explains later.”",
    "“A storm clears the air. Afterward everything smells new.”",
    "“My father said: speak like thunder, once, and mean it. Then be quiet a long while.”",
    "“The first thunder of spring and the frogs all start singing. As if they'd been waiting for permission.”",
    "“Lightning never strikes the grass. Only the tall things. I stay short.”",
    "“Heaven's angry for a moment. The rain after lasts all night. That's mercy, I think.”",
    "“I count between the flash and the boom. Five, and it's far. One, and you pray.”",
  ],
  ice: [
    "“Ice is water that made up its mind. I admire it. I never could.”",
    "“In winter the river freezes and you can walk across. Then spring comes and you can't. Know which season you're in.”",
    "“Cold keeps things. Meat, fish, grudges. Be careful what you let freeze.”",
    "“A snowflake is never the same twice, they say. Neither is a monk's prayer, if he means it.”",
    "“Ice holds still, and it's still moving. Watch a glacier for a year, you'll see.”",
    "“Winter's not death. It's the land sleeping so it can wake.”",
    "“I like the quiet of snow. It covers everything equally, the temple and the midden.”",
    "“Ice melts from the edges in. Most hard things do.”",
  ],
  lifedeath: [
    "“Every herb that heals can kill, given enough. The difference is the dose. And the heart.”",
    "“I buried my mother last spring. Planted a plum on the grave. It flowered this year.”",
    "“Nothing in the marsh is wasted. What dies feeds the reeds. What the reeds drop feeds the fish.”",
    "“The dead don't frighten me. The ones who won't die frighten me. You've seen what's in the valley.”",
    "“A candle lives by burning. Stop the burning and you don't have a long-lived candle. You have wax.”",
    "“Being born's the first step to dying. Nobody holds it against the baby.”",
    "“Monks say let go. Mothers say hold on. Both are right, at different hours.”",
    "“A seed has to stop being a seed. That's the price of a tree.”",
  ],
  void: [
    "“The empty part of the net is what catches the fish. People forget that.”",
    "“A bowl's only a bowl because of the hole in it. Same with a door. Same with me, some mornings.”",
    "“Out on the water at night, no moon, no shore — that's when I know how small I am. It's restful.”",
    "“My teacher emptied his cup on my head when I came to him full of answers. Worst day of my life. Best teacher I had.”",
    "“A puppet's empty inside. That's how it dances. Stuff it full and it just sits there.”",
    "“The sky's empty and it holds the whole world. Doesn't seem to strain.”",
    "“When the tide goes out you see what was always there. Mud, mostly. And pearls.”",
    "“A xiangqi board's mostly empty squares. That's where the game is.”",
  ],
};

/** What she sees when she watches each Dao at work in the world. */
const SEES: Record<GreatDaoId, string[]> = {
  water: [
    "She watches a drop fall from the lip of the waterwheel, again and again, into the same hollow it has made in the stone.",
    "Rain on the lake: every ring spreads, meets the others, and the lake is level again before she can count them.",
    "A leaf on the stream catches on a stone, turns, and goes on. The stream never noticed.",
    "She watches mist rise off the water at dawn, and understands it is the same water going home a different way.",
    "The tide of the lake creeps under a boulder and lifts it, very slightly. She would not have believed it.",
    "Water in a jar, water in a cup, water in her hand. The same water, three shapes, none of them its own.",
  ],
  wood: [
    "A bamboo shoot cracks a flagstone. It took a year. It will take another year to lift it.",
    "She watches a vine find its way up a post by touch, like a blind man going upstairs.",
    "The stump of a felled pine has a green shoot on it. The pine does not seem to have heard it was cut down.",
    "Wind bends the grove almost to the ground, and lets it go, and it stands.",
    "A seed in a crack in the rock, a fist of moss, a tree. She sees all three on one path.",
    "Leaves turn their faces after the sun all day, so slowly she only knows it by the evening.",
  ],
  wind: [
    "She watches the wind move through tall grass like a hand stroking a cat.",
    "A hawk hangs on the wind without a wingbeat, and then simply leaves.",
    "Prayer flags snap; smoke leans; a child's hair blows across her face. She sees the wind by everything but itself.",
    "The wind changes and every herder on the hill turns to face it without a word.",
    "Dust devils dance over the plain and fall apart, and the dust settles exactly where it was.",
    "She stands still and lets the wind go round her, and for a moment does not know where she ends.",
  ],
  fire: [
    "A cook-fire eats its wood and leaves a pot of rice. She watches the trade, and finds it fair.",
    "Sparks go up into the dark and become, for a moment, stars.",
    "She watches a smith quench a blade: fire, then water, then a steel that is neither.",
    "The sun comes up over the badlands and the whole red cliff takes fire without burning.",
    "A lamp lights another lamp and loses nothing.",
    "She holds her hand above a candle, not quite close enough to hurt, and feels it give.",
  ],
  earth: [
    "A farmer turns the soil and the soil smells of rain and old leaves and everything that ever fell there.",
    "She watches the mountain's shadow move across the terraces all afternoon, and the mountain does not move at all.",
    "An ant carries a grain ten times its size across a stone, and the stone holds them both.",
    "Water pours onto the paddy and the earth drinks without hurrying.",
    "A grave mound and a seed bed side by side in the same earth. It does not seem to know the difference.",
    "She lays her palm on the ground and feels, very far down, something holding everything up.",
  ],
  metal: [
    "A smith draws an edge with ten thousand strokes of the whetstone. None of them is the edge. All of them are.",
    "She watches a bell cast in the morning and hung by evening, and when it is struck the whole valley answers.",
    "Rust eats a fallen helmet in the rain. Under the rust, the iron is still iron.",
    "A sword in its sheath, at rest, and somehow still sharp.",
    "Silver tarnishes; gold does not. She thinks about which one she would rather be, and is not sure.",
    "A plough comes up out of the furrow shining, worn bright by the earth it cuts.",
  ],
  thunder: [
    "The flash, and then the count: one, two, three, four. Heaven's voice takes its time.",
    "She watches a storm walk across the fields on legs of rain.",
    "After the thunder, the air smells clean and sharp, and every leaf is shining.",
    "Lightning splits an old dead pine. By spring there is a sapling in the split.",
    "She feels the hair on her arms rise before the bolt, and understands that heaven warns before it strikes.",
    "Thunder rolls round the hills and comes back to her changed, as if the mountains had answered.",
  ],
  ice: [
    "A waterfall frozen mid-fall: the water decided, and stayed decided.",
    "She watches an icicle drip and freeze, drip and freeze, and grow by its own patience.",
    "Snow covers the temple roof and the midden alike, and keeps no list.",
    "Under the ice of the pond, the fish are still moving, slowly, waiting.",
    "Her breath goes out white, and the cold makes a shape of it for a moment.",
    "A sheet of ice cracks with a sound like a bell, and does not break.",
  ],
  lifedeath: [
    "A beetle carries off a dead moth to feed its young.",
    "In the marsh, a fallen willow is covered in fungus and frogs and new willow shoots.",
    "She watches Bai Zhi weigh out a remedy grain by grain. One grain more and it would kill.",
    "A cicada sheds its old shell on a branch and flies away, and leaves its old self holding on.",
    "An old monk sits beside a dying dog all night, saying nothing, and in the morning buries it with his own hands.",
    "The plum blossom falls on a new grave and lies there, pink on brown, and neither seems to mind.",
  ],
  void: [
    "The tide goes out and leaves the flats bare: pools, shells, a boat on its side, all the things the sea was holding.",
    "A puppeteer lifts her hands and the puppet is still. Its whole life is in the strings, and the empty space between.",
    "She watches a xiangqi game: two old men, a board mostly empty, and every empty square full of threat.",
    "Night on the sea with no moon: the water and the sky are one dark, and the boats float in nothing.",
    "A temple bell is struck, and the sound is the empty inside of the bell, ringing.",
    "She looks into an empty rice bowl and sees, for a moment, everything it could hold.",
  ],
};

const OBSERVE_TITLES = ["What the {daoN} Does", "Watch and Be Still", "The {daoN} at {sightT}", "Eyes Open", "A Lesson Without Words"];
const CONTEMPLATE_TITLES = ["Sit Where It Runs Strong", "Breathe With the {daoN}", "Stillness", "The Long Sitting"];
const ASK_TITLES = ["Ask {npcS}", "What {npcS} Knows", "The {daoN}, in Plain Words", "A Question for {npcS}"];
const TRIAL_TITLES = ["The Hollowed", "Empty Hands", "{N} Hollow Faces", "They Follow the Dao-Eater", "What Is Left of Them"];
const TRIAL_BRIEF = [
  "Cultivators who followed Wei Kongming, and tried to eat what he eats, and were eaten instead. They wander round the stele, hungry. Put them to rest.",
  "Hollow things are drifting round {place}, empty as old bowls. Qingxu says they were people once. Face them.",
  "The Dao-Eater leaves his followers behind like husks. They are dangerous, and they are suffering. End it.",
  "Something hollow moves near the stele at night. It wants the verse back, or wants yours. Stop it.",
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const bare = (s: string) => s.replace(/^the /, "");
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? k);
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export const BOOK_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** "Water", "Life and Death" (for titles). */
const daoNoun = (dao: GreatDaoId) => GREAT_DAOS[dao].name.replace(/^Dao of (the )?/, "");
/** "water", "life and death", "the void" (in a sentence). */
const daoWord = (dao: GreatDaoId) => (dao === "void" ? "the void" : daoNoun(dao).toLowerCase());
/** "the Echo of Still Water", but "Wei Kongming". */
const theFoe = (name: string) => (name.startsWith("Echo") ? `the ${name}` : name);

// ----------------------------------------------------------------------------- the questions
interface KoanOption {
  /** Which Dao of the heart the answer leans her toward. */
  heart: DaoId;
  label: string;
  hint?: string;
  /** What happens, narrated. */
  then: string;
  /** What the one who asked says. */
  reply: string;
  /** How deeply she must comprehend the book's Great Dao to see this answer (a stage, 1 Entry … 5). */
  wu?: number;
  /** What it brings beyond the Dao. */
  effect?: (g: GameState) => GameState;
}

interface Koan {
  title: string;
  ask: string;
  options: KoanOption[];
}

const quiet = (by: number) => (g: GameState) => shift(g, CULT.demon, -by);
const feed = (by: number) => (g: GameState) => shift(g, CULT.demon, by);

/** The Road's questions; each book draws nine, with its own Dao and place filled in. */
export const KOANS: Koan[] = [
  {
    title: "The Empty Cup",
    ask: "Qingxu pours you tea until it runs over the table. “The Dao-Eater's cup was empty all his life. Yours is full. Which of you can learn the {Dao}?”",
    options: [
      { heart: "balance", label: "Empty the cup", then: "She tips her tea out onto the ground and holds the empty cup out to him.", reply: "Ha! Good. Now there is room in it." },
      { heart: "mercy", label: "Neither, until he is helped", then: "She says no one learns alone, and that someone should have sat with Kongming when he was young.", reply: "…Someone should have. I was his teacher, once, for a month. I gave up." },
      { heart: "sword", label: "Drink it, and ask again", then: "She drinks the tea in one swallow and sets down the cup.", reply: "A full stomach and an empty cup. That is also an answer." },
      { heart: "slaughter", label: "Whoever takes it first", then: "She says the Dao goes to whoever is strong enough to hold it.", reply: "That is what he says. Word for word. Be careful, child." },
    ],
  },
  {
    title: "The Hollow Disciple",
    ask: "A hollow shade has stopped at {noun} and sits weeping, still half a person. It asks you, in a voice like wind in a jar, to finish it.",
    options: [
      { heart: "mercy", label: "Sit with it until it goes", then: "She sits by the shade until dawn, talking to it of ordinary things. At sunrise it is gone, and the grass where it sat is green.", reply: "You gave it back a morning. That is more than he ever gave it.", effect: quiet(4) },
      { heart: "sword", label: "One clean stroke", then: "She draws and cuts once. The shade comes apart like smoke, and the last thing it does is bow.", reply: "Quick, and kind, and it thanked you. Remember that it thanked you." },
      { heart: "balance", label: "Give its breath back to the land", hint: "Lesser Mastery", wu: 2, then: "She lays her palm on the ground and gives back to the {Dao} what the shade was holding. It sighs, and is only wind.", reply: "You can do that already? Your founder took twelve years to learn it." },
      { heart: "slaughter", label: "Take what it has left", then: "She draws its last breath of the {Dao} into herself. It tastes of ash.", reply: "…You did what he would have done. I am not angry. I am afraid.", effect: feed(6) },
    ],
  },
  {
    title: "The Stele and the Village",
    ask: "The folk near {noun} want to grind the broken stele into road stone. “It is only a rock now, immortal. Our cart road floods every spring.”",
    options: [
      { heart: "mercy", label: "Let them have it", then: "She helps them break it up herself. The road will not flood next spring.", reply: "Hm. The founder would have laughed. A road is a kind of verse, too." },
      { heart: "balance", label: "Carve the verse into the new road", then: "She cuts the founder's words into the road stones as they are laid, so that every cart that passes rolls over the {Dao}.", reply: "Every traveller will read it with their feet. Beautiful." },
      { heart: "sword", label: "Forbid it", then: "She stands before the stele, and the villagers go away muttering.", reply: "Firm. They will flood next spring, mind." },
      { heart: "slaughter", label: "Threaten them away", then: "She shows them her sword, and they run. One drops his hoe.", reply: "They will remember the sword and forget the stele. Was that the trade you wanted?", effect: feed(3) },
    ],
  },
  {
    title: "Kongming's Letter",
    ask: "Qingxu hands you a letter he found at the stele. It is from Wei Kongming, addressed to you. “I hear you are following me. Tell me what the {Dao} feels like. I have eaten it, and I still do not know.”",
    options: [
      { heart: "mercy", label: "Write back, kindly and honestly", then: "She writes to him all night: what the {Dao} feels like, as well as she can say it. She leaves it at the stele.", reply: "He will read it. He reads everything. I do not know if it will help him or hurt him more." },
      { heart: "balance", label: "Write back: “Stop eating, and wait.”", then: "She writes only that: stop eating, and wait.", reply: "Four words. The founder's whole canon in four words. He will hate that." },
      { heart: "sword", label: "Write back: “Come and ask me.”", then: "She writes: come and ask me yourself. She signs it with her sword's name.", reply: "A challenge. He will come, in time. Be stronger by then." },
      { heart: "slaughter", label: "Burn it", then: "She burns the letter without answering.", reply: "That is what everyone he ever wrote to did." },
    ],
  },
  {
    title: "The Shortcut",
    ask: "A hollow sage offers you a pill made from the eaten {daoN}. “Swallow it, and you will understand in a moment what took your founder ten years.”",
    options: [
      { heart: "balance", label: "Refuse: ten years is the point", then: "She hands the pill back. The hollow sage does not understand, and that is its whole tragedy.", reply: "Good. Understanding that took no time is worth no time." },
      { heart: "sword", label: "Crush it underfoot", then: "She grinds the pill into the dirt with her heel.", reply: "Decisive. Next time, maybe ask me what it was first." },
      { heart: "mercy", label: "Take it to Qingxu, to bury properly", then: "She carries it to Qingxu wrapped in a leaf, and he buries it beneath a tree.", reply: "Thank you. Whatever it was once, it was somebody's understanding." },
      { heart: "slaughter", label: "Swallow it", then: "She swallows it. For a moment the {Dao} roars through her. Then it is gone, and something is wrong in her meridians.", reply: "Spit it — too late. Sit down. Breathe. Oh, child.", effect: (g) => feed(8)(shift(g, CULT.tox, 20)) },
    ],
  },
  {
    title: "The Child at the Stele",
    ask: "A child from {place} has been coming to the broken stele every day to read it, though there is nothing left to read. “Will the words come back, immortal? I was nearly at the end.”",
    options: [
      { heart: "mercy", label: "“Yes. I promise.”", then: "She promises. The child believes her completely, which is the most frightening thing that has happened to her in some time.", reply: "Now you have to. Good. Promises are a kind of cultivation." },
      { heart: "balance", label: "Teach the child what you remember", hint: "Entry", wu: 1, then: "She recites what she knows of the {Dao} to the child, line by line. The child repeats it back, slightly wrong, and better.", reply: "There. Now the verse lives in two people. He cannot eat that." },
      { heart: "sword", label: "“They will, when I have earned them back.”", then: "She tells the child she will bring the words back herself, and the child salutes her very seriously.", reply: "You have a disciple now. Careful. They copy everything." },
      { heart: "slaughter", label: "Send the child home: this is no place for her", then: "She sends the child away sharply. It is dangerous here, after all. The child cries all the way home.", reply: "You were right about the danger. That does not make it right." },
    ],
  },
  {
    title: "Heaven's Ledger",
    ask: "Qingxu asks, quite seriously: “If the {Dao} is the Way of heaven and earth, why did heaven let one man eat it? What do you think heaven is doing?”",
    options: [
      { heart: "balance", label: "Heaven acts through people. Through us.", then: "She says that heaven did not let him: it sent her.", reply: "Then you had better be what heaven meant." },
      { heart: "sword", label: "Heaven does nothing. We act.", then: "She says heaven is the sky and the sky has no hands.", reply: "Many cultivators believe that. Most of them are very strong and very lonely." },
      { heart: "mercy", label: "Heaven is waiting to see if anyone helps him", then: "She says perhaps heaven is waiting to see if anyone will help the Dao-Eater, not only stop him.", reply: "…I had not thought of it like that. I have thought about him for twenty years." },
      { heart: "slaughter", label: "Heaven is weak", then: "She says if heaven could not stop one man it does not deserve the Dao.", reply: "That is the thought that started him eating, you know." },
    ],
  },
  {
    title: "The Copyist's Hands",
    ask: "Qingxu's hands shake too much to copy the stele any more. “I have one more copy in me, perhaps. Should I spend it here, or keep it for the last stele?”",
    options: [
      { heart: "mercy", label: "Copy it here, and I will copy the last for you", then: "She promises to be his hands at the last stele. He copies this one slowly, with her steadying his wrist.", reply: "Then we will finish together. Thank you." },
      { heart: "balance", label: "Do not copy at all. Remember.", then: "She tells him he has copied it nine times; it is in him already.", reply: "…Sixty years of copying, and you are the first to say that. You are right. It is." },
      { heart: "sword", label: "Keep it for the last", then: "She tells him to save his strength for the end.", reply: "Practical. Yes. The end is what matters." },
      { heart: "slaughter", label: "Let me copy it — and keep the copies", then: "She takes the brush and copies the verse herself, and tucks the copy into her own robe.", reply: "…Those were for the sect library. But, well. Keep them safe." },
    ],
  },
  {
    title: "The Mirror of the Dao",
    ask: "At {noun} a still pool shows not your face but your {Dao}: how much of it is truly yours, and how much you have only heard of. Qingxu asks what you see.",
    options: [
      { heart: "balance", label: "“Less than I thought.”", then: "She tells him honestly: there is less of it in her than she thought.", reply: "Then you can see. The ones who see more than they have are the dangerous ones." },
      { heart: "sword", label: "“Enough to fight with.”", then: "She tells him she sees enough to fight with.", reply: "Enough to fight with is not the same as enough to live with. But it is a start." },
      { heart: "mercy", label: "“Other people. Everyone I asked.”", hint: "Lesser Mastery", wu: 2, then: "She says the {Dao} in the pool has the faces of everyone who told her what it meant.", reply: "Ah. Yes. That is what your founder saw too. She wrote it in the margin of the fifth stele." },
      { heart: "slaughter", label: "“More. I want more.”", then: "She says she wants more of it, much more.", reply: "Wanting is not bad. Wanting only is.", effect: feed(3) },
    ],
  },
  {
    title: "The Hollow Monk's Request",
    ask: "A hollow ascetic who still remembers his name asks you to take his begging bowl to his old monastery, so they know what became of him.",
    options: [
      { heart: "mercy", label: "Promise to carry it, and do", then: "She takes the empty bowl. The ascetic bows, and comes apart in the wind, and she carries his bowl the long way round to his old gate.", reply: "His abbot will weep. Good. Somebody should weep for them.", effect: quiet(3) },
      { heart: "balance", label: "Fill the bowl with rice and leave it at the stele", then: "She fills the bowl and leaves it at the stele for whatever hollow thing comes next.", reply: "A bowl that is filled for others. That was the founder's whole teaching." },
      { heart: "sword", label: "End him first, then carry it", then: "She ends him gently and carries his bowl to the gate.", reply: "Both. You are learning to do both." },
      { heart: "slaughter", label: "Smash the bowl", then: "She breaks the bowl over her knee.", reply: "He followed an eater. You have just shown him what eaters do.", effect: feed(3) },
    ],
  },
  {
    title: "The Merchant of Verses",
    ask: "A merchant at {noun} is selling “genuine copies” of the founder's verse on the {Dao}. They are wrong in every line. Folk are buying them in dozens.",
    options: [
      { heart: "balance", label: "Correct the copies, line by line", then: "She sits with the merchant all afternoon correcting the copies. He sells them at double the price the next day, as “corrected by an immortal”.", reply: "Ha! Well, at least now they are right." },
      { heart: "mercy", label: "Let it be: wrong verses still make people think", then: "She lets it be. A boy buys one and reads it all the way home, moving his lips.", reply: "True. The founder's own first verse was wrong, you know. She corrected it later." },
      { heart: "sword", label: "Expose him in the market", then: "She reads his copies aloud in the market beside the true verse. He packs up and leaves.", reply: "Hard on him. Fair to them." },
      { heart: "slaughter", label: "Burn his stock", then: "She burns his whole cart of scrolls.", reply: "And the boy who wanted to read? He will not read now.", effect: feed(2) },
    ],
  },
  {
    title: "Two Disciples",
    ask: "Two young cultivators at {noun} quarrel: one says the {Dao} must be understood slowly in stillness, the other that it must be fought for. They ask you to judge.",
    options: [
      { heart: "balance", label: "Both, in their seasons", then: "She tells them both are right, at different hours. Neither is satisfied. Both are thoughtful.", reply: "The best judgements leave everyone a little unhappy." },
      { heart: "sword", label: "Spar with each, and let them see", then: "She spars with each in turn, and each finds out what the other was talking about.", reply: "Showing, not telling. Good." },
      { heart: "mercy", label: "Make them sit together and ask each other", then: "She makes them ask each other questions until supper. By supper they are friends.", reply: "You are wasted on swords, you know." },
      { heart: "slaughter", label: "Whichever wins a fight is right", then: "She tells them to fight it out. One breaks an arm.", reply: "And now the one with the broken arm will never believe the other. Was that the lesson?", effect: feed(2) },
    ],
  },
  {
    title: "The Founder's Mistake",
    ask: "Qingxu shows you a line struck out on an old rubbing of this stele: the founder's first verse on the {Dao}, which she later corrected. “She was wrong once. Does that make you trust her more, or less?”",
    options: [
      { heart: "balance", label: "More", then: "She says a teacher who corrects herself is a teacher who is still learning.", reply: "That is why I have copied her nine times. She was never finished." },
      { heart: "sword", label: "Neither. I trust what is true.", then: "She says she trusts the verse, not the woman.", reply: "Sharp. She would have liked you." },
      { heart: "mercy", label: "More — she was human", then: "She says it is a comfort that the founder was once as lost as she is.", reply: "It comforted me too, when I was young. It still does." },
      { heart: "slaughter", label: "Less", then: "She says a teacher who can be wrong can be wrong again.", reply: "Yes. And so can you. Remember that when you are the teacher." },
    ],
  },
  {
    title: "The Price of the Verse",
    ask: "To mend the stele faster, Qingxu says, she could pour her own cultivation into it. It would cost her dearly, and save the land weeks.",
    options: [
      { heart: "mercy", label: "Pour it in", then: "She lays her hands on the stele and pours her qi into it until her knees give. The stone drinks.", reply: "Too much! Too much, you foolish — thank you. Thank you.", effect: (g) => ({ ...g, qi: 0, hp: Math.max(1, Math.round(g.hp * 0.5)) }) },
      { heart: "balance", label: "Pour in only what the land gives back", hint: "Greater Mastery", wu: 3, then: "She draws qi from the earth with one hand and gives it to the stele with the other, and loses nothing.", reply: "I have never seen that done. I have only read about it." },
      { heart: "sword", label: "No. I will need my strength for the Echo.", then: "She keeps her strength.", reply: "Wise. The land can wait a few weeks." },
      { heart: "slaughter", label: "Pour in a hollow shade's instead", then: "She drains the next hollow shade she meets and pours what she took into the stele.", reply: "It works. I wish it had not.", effect: feed(4) },
    ],
  },
  {
    title: "Where He Came From",
    ask: "Qingxu tells you Wei Kongming was a foundling, raised in a monastery where he could never feel what the others felt in meditation. “They called him the stone. What would you have done with him, if he had been your junior?”",
    options: [
      { heart: "mercy", label: "Loved him anyway", then: "She says she would have taken him out to watch the rain, and not asked him to feel anything.", reply: "…Nobody did that. Nobody thought of it." },
      { heart: "balance", label: "Found him a different road", then: "She says not everyone has to cultivate; he could have been a carpenter, a scribe, a fisherman.", reply: "He would have been a very good scribe. He has the most beautiful handwriting I have ever seen." },
      { heart: "sword", label: "Trained him harder", then: "She says she would have trained him until he felt something, even if it was only pain.", reply: "That is what they did. It is how he learned to eat." },
      { heart: "slaughter", label: "Sent him away", then: "She says some people cannot cultivate, and should not try.", reply: "That is what they did, in the end. He has been trying to prove them wrong ever since." },
    ],
  },
  {
    title: "The Khan's Teacher",
    ask: "In the stele's dust you find a strip of steppe felt, and Qingxu goes pale. “He came here with a horseman. A big man, wolf-skin on his shoulders. Kongming taught Tuoba Hong to eat beast cores. Did you know? Everything the horde did, it learned from him.”",
    options: [
      { heart: "sword", label: "Then he answers for the war too", then: "She says when she finds the Dao-Eater he will answer for every burned field.", reply: "Yes. He should. I only hope there is still a man there to answer." },
      { heart: "mercy", label: "Then two people needed help, and neither got it", then: "She says the Khan was a hungry man too, once.", reply: "Envoy Kou says the same. He says the Khan was good, before the first core." },
      { heart: "balance", label: "Then the war and the Road are one road", then: "She says she will walk both to the end, and they will meet.", reply: "They will. At the sea, I think. Everything ends at the sea." },
      { heart: "slaughter", label: "Then I will eat his student's cores too", then: "She says if eating works for them, it can work for her.", reply: "Do not say that again. Not even as a joke.", effect: feed(4) },
    ],
  },
  {
    title: "The Hidden Verse",
    ask: "On the back of the stele, under the moss, you find a second, smaller verse the founder never showed anyone: “I do not understand the {Dao}. I only love it.” Qingxu asks if you will tell the sect.",
    options: [
      { heart: "mercy", label: "Tell everyone", then: "She copies it out to send to the Hall of Clouds. Archivist Shen will cry, she thinks.", reply: "Yes. Let them know their founder was a person." },
      { heart: "balance", label: "Leave it under the moss", then: "She smooths the moss back over it.", reply: "For the next one who looks. Yes. That is right." },
      { heart: "sword", label: "Keep it for yourself", hint: "Entry", wu: 1, then: "She reads it three times and keeps it in her heart, and tells no one.", reply: "A secret between you and her. I will not ask." },
      { heart: "slaughter", label: "Scrape it off", then: "She scrapes it off: the sect needs a founder who understood, not one who only loved.", reply: "…You are wrong. But I understand why you think it." },
    ],
  },
  {
    title: "Rest or Road",
    ask: "You have been walking the Road a long time. Qingxu says: “Stay a few days at {place}. The stele can wait. Can you?”",
    options: [
      { heart: "balance", label: "Rest", then: "She stays three days, fishes, sleeps, eats too much. On the fourth she understands something about the {Dao} she had been too busy to see.", reply: "You see? Rest is part of the Road.", effect: (g) => quiet(5)(heal(g, 9999, 9999)) },
      { heart: "sword", label: "Go on", then: "She shoulders her pack and goes on.", reply: "Then I go with you. Slowly." },
      { heart: "mercy", label: "Rest, and help the folk while you do", then: "She spends three days mending roofs and carrying water.", reply: "That is not resting. But it is something better." },
      { heart: "slaughter", label: "Go on, and hunt the hollowed as you go", then: "She goes on, cutting down every hollow thing she meets.", reply: "You will get there faster. I am not sure you will get there.", effect: feed(2) },
    ],
  },
];

// ----------------------------------------------------------------------------- composing the quests
/** What the Road asks of her at a quest: the book's realm, a step more after its middle, and Spirit Severing's peak for the Dao-Eater. */
function levelFor(book: number, step: number): number {
  if (book === 9 && step === 99) return 19;
  return BOOKS[ROAD_DAOS[book]].level + (step >= 50 ? 1 : 0);
}

/** The keeper who waits at each book's stele. */
export const keeperKey = (book: number) => `keeper-${ROAD_DAOS[book]}`;

const KEEPER = { name: "Daoist Qingxu", char: "keeper" as HumanId };

/** Who answers to a Road NPC key, with their name and look (the keeper, the tide folk, or the folk of the jianghu). */
export function roadPerson(key: string): { key: string; name: string; char: HumanId; region: AreaId } {
  if (key.startsWith("keeper-")) return { key, ...KEEPER, region: ROAD_SITES[ROAD_DAOS.indexOf(key.slice(7) as GreatDaoId)]?.region ?? "sect" };
  const t = tideFolk(key);
  if (t) return { key, name: t.name, char: t.char, region: "harbor" };
  const f = FOLK.find((x) => x.key === key)!;
  return { key, name: f.name, char: f.char, region: f.region };
}

const REGION_PLACE: Record<AreaId, string> = {
  sect: "the Azure Cloud Sect",
  village: "Willow Creek",
  bamboo: "the Whispering Bamboo",
  lake: "the Lotus Lake",
  valley: "the Crimson Demon Valley",
  peak: "Heavenly Tribulation Peak",
  marsh: "the Mistmarsh",
  terraces: "the Cloudmist Terraces",
  desert: "the Yellow Sands",
  harbor: "the eastern shore",
  frost: "Frostveil",
};

/** Where a landmark is, in words (the Road's own places as well as the bounties' sights). */
function sightName(key: string): string {
  const s = SIGHTS.find((x) => x.key === key);
  if (s) return s.name;
  if (key === "hailing") return "the port of Hailing";
  if (key === "saltwind") return "Saltwind's salt pans";
  const b = ROAD_DAOS.findIndex((_, k) => steleKey(k) === key);
  return b >= 0 ? `the broken stele at ${BOOKS[ROAD_DAOS[b]].place}` : key;
}

const sightRegion = (key: string): AreaId => SIGHTS.find((x) => x.key === key)?.region ?? (key === "hailing" || key === "saltwind" ? "harbor" : ROAD_SITES[ROAD_DAOS.findIndex((_, k) => steleKey(k) === key)]?.region ?? "sect");

const KINDS: [RoadKind, number][] = [
  ["trial", 0.28],
  ["ask", 0.26],
  ["observe", 0.24],
  ["contemplate", 0.22],
];

function pickKind(r: number): RoadKind {
  for (const [k, w] of KINDS) {
    if (r < w) return k;
    r -= w;
  }
  return "trial";
}

/** The nine questions a book draws (no repeats within it). */
function koansOf(book: number): number[] {
  return KOANS.map((_, i) => i)
    .sort((a, b) => hash2(a, book, 6161) - hash2(b, book, 6161))
    .slice(0, 9);
}

/** The hollowed she meets on each stretch of the Road, weakest first. */
const foeFor = (book: number): HollowId => (book < 3 ? "hollowshade" : book < 7 ? "hollowmonk" : "hollowsage");

function compose(id: number): RoadQuest {
  const book = Math.floor(id / ROAD_BOOK);
  const step = id % ROAD_BOOK;
  const dao = ROAD_DAOS[book];
  const B = BOOKS[dao];
  const h = (k: number) => hash2(id, k, 8819);
  const at = <T>(arr: readonly T[], k: number) => arr[Math.floor(h(k) * arr.length)];
  const level = levelFor(book, step);
  const keeper = keeperKey(book);
  const v: Record<string, string> = { place: B.place, daoN: daoNoun(dao), dao: daoWord(dao), Dao: GREAT_DAOS[dao].name };
  const reward = (cultK: number, stoneK = 1) => ({ stones: Math.round((12 + book * 8 + step * 0.2) * stoneK), cult: cultK });
  const base = { id, book, step, dao, level };
  const stele = steleKey(book);

  if (step === 0)
    return {
      ...base,
      kind: "seek",
      title: `Book ${BOOK_NUMERALS[book]} · ${B.title}`,
      objective: book === 0 ? `A wandering Daoist named Qingxu has been asking for the Azure Cloud's disciple at ${B.place}. Find him beside the founder's stele.` : `Daoist Qingxu has gone ahead to ${B.place}. Meet him at the founder's stele of ${daoNoun(dao)}.`,
      brief: B.keeper,
      npc: keeper,
      count: 1,
      done: B.hollowing,
      wu: 1,
      reward: reward(0.08, 2),
    };
  if (step === 98)
    return {
      ...base,
      kind: "stele",
      title: "Read the Mended Stele",
      objective: `The founder's stele of ${daoNoun(dao)} at ${B.place} is whole enough to read. Read it with Daoist Qingxu.`,
      brief: `Ninety-seven steps on the Road, and the stele's verse has crept back into the stone, line by line. Read it with me. Whatever wears the eaten ${daoNoun(dao)} will come when it hears.`,
      npc: keeper,
      count: 1,
      done: B.verse,
      wu: 4,
      reward: reward(0.12, 2),
    };
  if (step === 99) {
    const e = ENEMIES[echoOf(book)];
    return {
      ...base,
      kind: "echo",
      title: e.name,
      objective: `${cap(theFoe(e.name))} has come for the mended stele at ${B.place}. Face it there.`,
      brief: "",
      count: 1,
      done: B.victory,
      wu: 0,
      reward: reward(0.4, 6),
    };
  }
  if (step === 50)
    return {
      ...base,
      kind: "comprehend",
      title: "Beyond Your Understanding",
      objective: `The rest of the stele will not show itself to you yet. Reach ${realmLabel(...realmOf(level))} and comprehend the ${GREAT_DAOS[dao].name} to ${WU_TIERS[1].name} (sit at shrines where it runs strong, watch it, ask, answer the Road's questions).`,
      brief: "",
      count: 1,
      done: "The stele's next lines surface in the stone as she looks at it, as if they had been waiting for her.",
      wu: 0,
      reward: reward(0.05, 1),
    };
  if (step % 10 === 9) {
    const k = koansOf(book)[Math.floor(step / 10)];
    const K = KOANS[k];
    return {
      ...base,
      kind: "koan",
      title: K.title,
      objective: `Daoist Qingxu has a question for you at ${B.place}.`,
      brief: fill(K.ask, { ...v, noun: at(B.sights.map(sightName), 1) }),
      npc: keeper,
      koan: k,
      count: 1,
      done: "",
      wu: 2,
      reward: reward(0.12, 1.4),
    };
  }
  const kind = pickKind(h(2));
  switch (kind) {
    case "trial": {
      const n = 1 + Math.floor(h(3) * (book < 2 ? 2 : 3));
      const foe = foeFor(book);
      return {
        ...base,
        kind,
        title: fill(at(TRIAL_TITLES, 4), { N: ["One", "Two", "Three"][n - 1] }),
        objective: `Put ${n} of the hollowed (${ENEMIES[foe].name}s) to rest near the broken stele at ${B.place}.`,
        brief: fill(at(TRIAL_BRIEF, 5), v),
        count: n,
        foe,
        done: n === 1 ? "The hollow thing comes apart like smoke, and the stele seems a little less alone." : "The last of them comes apart like smoke. Something in the stone loosens.",
        wu: 1,
        reward: reward(0.04 + n * 0.01, 1.3),
      };
    }
    case "ask": {
      const who = roadPerson(at(B.folk, 6));
      const vv = { ...v, npcS: who.name.split(" ").slice(-1)[0] };
      return {
        ...base,
        kind,
        title: fill(at(ASK_TITLES, 7), vv),
        objective: `Ask ${who.name} (${REGION_PLACE[who.region]}) what ${daoWord(dao)} means to them.`,
        brief: `“The founder asked everyone,” Qingxu says. “Fishermen, farmers, children. Go and ask ${who.name}. Do not tell them what you think first.”`,
        npc: who.key,
        count: 1,
        done: at(ASKS[dao], 8),
        wu: 1,
        reward: reward(0.04),
      };
    }
    case "observe": {
      const sight = at([stele, ...B.sights], 9);
      const how = at(["any", "any", "night", "day", "ride", "fly"] as const, 10);
      const howText = { any: "", night: " after dark", day: " by daylight", ride: " on Cloudmane", fly: " on your flying sword" }[how];
      return {
        ...base,
        kind,
        title: fill(at(OBSERVE_TITLES, 11), { ...v, sightT: titleCase(bare(sightName(sight))) }),
        objective: `Go to ${sightName(sight)}${howText} and watch ${daoWord(dao)} at work.`,
        brief: `“Do not read about it,” says Qingxu. “Go to ${sightName(sight)}${howText}, and watch.”`,
        landmark: sight,
        how,
        count: 1,
        done: at(SEES[dao], 12),
        wu: 1,
        reward: reward(0.05, 1.1),
      };
    }
    case "contemplate":
    default: {
      const n = 6 + Math.floor(h(13) * 4) * 2;
      const region = at(B.shrines, 14);
      return {
        ...base,
        kind: "contemplate",
        title: fill(at(CONTEMPLATE_TITLES, 15), v),
        objective: `Sit ${n} breaths at a lotus shrine in ${REGION_PLACE[region]}, where the Dao of ${daoNoun(dao)} runs strong.`,
        brief: `“The Dao of ${daoNoun(dao)} is strong at the shrines of ${REGION_PLACE[region]}. Sit there, ${n} breaths, and do not try to understand anything.”`,
        region,
        count: n,
        done: `For a breath, at the bottom of her stillness, she feels ${daoWord(dao)} move the way the founder felt it.`,
        wu: 1,
        reward: reward(0.05),
      };
    }
  }
}

/** [realm, stage] for an overall level index. */
function realmOf(level: number): [number, number] {
  let n = level;
  for (let r = 0; r < REALMS.length; r++) {
    if (n < REALMS[r].stages) return [r, n];
    n -= REALMS[r].stages;
  }
  return [REALMS.length - 1, 0];
}

let all: RoadQuest[] | null = null;
/** Every quest of the Road (composed once). */
export function roadQuests(): RoadQuest[] {
  return (all ??= Array.from({ length: ROAD_COUNT }, (_, id) => compose(id)));
}
export const roadQuestAt = (id: number) => roadQuests()[id];

// ----------------------------------------------------------------------------- the save
export const roadDone = (g: GameState) => Math.max(0, Math.min(ROAD_COUNT, g.counters.road ?? 0));
const roadProgress = (g: GameState) => g.counters.roadp ?? 0;

/** Whether the Road has reached her: Elder Mo has sent her out, and she has built her foundation (a disciple below that could not read a stele). */
export const roadOpen = (g: GameState) => !!g.flags.metElder && (g.realm >= 1 || roadDone(g) > 0);

/** The quest she is on, or null before the Road reaches her and after it ends. */
export function currentRoad(g: GameState): RoadQuest | null {
  if (!roadOpen(g)) return null;
  const n = roadDone(g);
  return n < ROAD_COUNT ? roadQuestAt(n) : null;
}

/** Whether her cultivation is equal to what the Road asks of her now (and, past a book's middle, her understanding too). */
export function strongEnough(g: GameState, q: RoadQuest): boolean {
  if (levelIndex(g.realm, g.stage) < q.level) return false;
  return q.step < 50 || q.kind === "comprehend" || wuTier(g, q.dao) >= Math.min(2, wuCap(g.realm));
}

/**
 * Bring the Road's flags in line with its progress, so the land follows:
 * `roadat:<dao>` while Qingxu waits at a book's stele, `hollowed:<dao>`
 * while its land has lost the Dao, `echo:<dao>` while its Echo is out, and
 * `restored:<dao>` once it is done. They follow her realm too (the Road
 * reaches her when her foundation is built), so the game keeps them in step
 * as it goes, not only when a quest is done.
 */
export function syncRoadFlags(g: GameState): GameState {
  const n = roadDone(g);
  const book = Math.min(ROAD_DAOS.length - 1, Math.floor(n / ROAD_BOOK));
  const step = n % ROAD_BOOK;
  const flags: Record<string, boolean> = { ...g.flags, "road:begun": n >= 1, "road:done": n >= ROAD_COUNT };
  ROAD_DAOS.forEach((dao, k) => {
    const current = n < ROAD_COUNT && k === book && roadOpen(g);
    flags[`roadat:${dao}`] = current;
    flags[`hollowed:${dao}`] = current && step >= 1;
    flags[`echo:${dao}`] = current && step === 99;
    flags[`restored:${dao}`] = n >= ROAD_BOOK * (k + 1);
  });
  // the same state back when nothing has moved, so the game can keep them in step every tick for free
  return Object.keys(flags).some((k) => !!flags[k] !== !!g.flags[k]) ? { ...g, flags } : g;
}

/** Outfits along the Road. */
export const ROAD_MILESTONES: { at: number; attire: string; note: string }[] = [
  { at: 100, attire: "pilgrim", note: "A hundred steps on the Founder's Road: Qingxu gives you the hemp robe he walked his first Road in. It still smells of sixty years of ink." },
  { at: 500, attire: "daomantle", note: "Five hundred steps, five steles mended: the steles themselves seem to weave you a mantle, ten verses embroidered in jade thread round the hem (five of them still blank)." },
];

/** Grant what the Road brings: comprehension of the book's Dao (with a word if she reaches a new stage, or her realm holds her back). */
function understand(g: GameState, dao: GreatDaoId, by: number, eaten = false): { state: GameState; note: string | null } {
  if (by <= 0) return { state: g, note: null };
  const r = comprehend(g, dao, by, eaten);
  const G = GREAT_DAOS[dao];
  if (r.tierUp) return { state: r.state, note: `${G.hanzi} ${G.name}: ${WU_TIERS[r.tierUp - 1].hanzi} ${WU_TIERS[r.tierUp - 1].name}` };
  if (r.capped) return { state: r.state, note: `Your realm can hold no more of the ${G.name} yet` };
  return { state: r.state, note: null };
}

/** Mark the current quest done: pay out, deepen her understanding, move the Road on, and hand out any milestone outfit. */
export function completeRoad(g: GameState, id: number): GameState {
  if (roadDone(g) !== id) return g;
  const q = roadQuestAt(id);
  let s: GameState = { ...g, counters: { ...g.counters, road: id + 1, roadp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  s = understand(s, q.dao, q.wu).state;
  const m = ROAD_MILESTONES.find((x) => x.at === id + 1);
  if (m) s = giveAttire(s, m.attire);
  return syncRoadFlags(s);
}

const advanceRoad = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, roadp: roadProgress(g) + by } });

// ----------------------------------------------------------------------------- how the Road speaks
const named = (who: HumanId, name: string, text: string): Step => ({ say: who, name, text });
const narr = (text: string): Step => ({ say: "narrator", text });

/** The steps that finish a quest: a toast, the understanding it brings, and any outfit. */
function finish(q: RoadQuest, g: GameState): Step[] {
  const next = completeRoad(g, q.id);
  const m = ROAD_MILESTONES.find((x) => x.at === q.id + 1);
  const gained = understand(g, q.dao, q.wu).note;
  const steps: Step[] = [{ mutate: (s) => completeRoad(s, q.id) }, { toast: `Founder's Road ${q.id + 1}/${ROAD_COUNT} done: ${q.title} · +${q.reward.stones} spirit stones${q.wu ? ` · the ${daoNoun(q.dao)} +${q.wu}` : ""}` }];
  if (gained) steps.push({ anim: "hero", name: "comprehend", wait: true }, { toast: gained });
  if (m) steps.push({ anim: "hero", name: "twirl", wait: true }, narr(m.note), { toast: "A gift of the Road: see the wardrobe (V)" });
  const after = currentRoad(next);
  if (after && after.kind === "seek" && q.kind !== "seek") steps.push({ toast: `Daoist Qingxu goes on ahead to ${BOOKS[after.dao].place}` });
  return steps;
}

/** She is not yet strong enough, or does not yet understand enough: the asker tells her so. */
function tooWeak(q: RoadQuest, who: { char: HumanId; name: string }, g: GameState): Step[] {
  const need = levelIndex(g.realm, g.stage) < q.level ? realmLabel(...realmOf(q.level)) : `${WU_TIERS[1].name} of the ${GREAT_DAOS[q.dao].name}`;
  return [named(who.char, who.name, `Not yet. What comes next on the Road would only go through you. Come back at ${need}.`), { toast: `The Road asks for ${need}` }];
}

/** How the people she meets on the Road see what she understands. */
export function wuWord(g: GameState, dao: GreatDaoId): string | null {
  const t = wuTier(g, dao);
  if (!t) return null;
  return [
    `You have the beginning of it. I can see it in how you stand.`,
    `There is more of the Dao of ${daoNoun(dao)} in you than there was. It shows in your breathing.`,
    `When you walk by, the ${daoWord(dao).replace(/^the /, "")} round here turns to look. Did you know?`,
    `You understand it better than I do now. That is how it should be.`,
    `You are not learning the ${daoNoun(dao)} any more. You are it, a little.`,
  ][t - 1];
}

/** A question of the Road: answers lean her heart, and deepen her understanding. */
function koanSteps(q: RoadQuest, g: GameState): Step[] {
  const K = KOANS[q.koan!];
  const who = { char: KEEPER.char, name: KEEPER.name };
  const tier = wuTier(g, q.dao);
  const usable = K.options.filter((o) => (o.wu ?? 0) <= tier);
  const locked = K.options.length - usable.length;
  // the same landmark the question was asked at (compose picks it from the quest's number)
  const sights = BOOKS[q.dao].sights;
  const v = { place: BOOKS[q.dao].place, daoN: daoNoun(q.dao), dao: daoWord(q.dao), Dao: GREAT_DAOS[q.dao].name, noun: sightName(sights[Math.floor(hash2(q.id, 1, 8819) * sights.length)]) };
  const options: Choice[] = usable.map((o) => ({
    label: o.label,
    hint: [o.hint, DAOS[o.heart].name].filter(Boolean).join(" · "),
    then: [
      { mutate: (s) => walkDao(o.effect ? o.effect(s) : s, o.heart, 1) },
      narr(fill(o.then, v)),
      named(who.char, who.name, o.reply),
      { toast: `Your heart leans toward the ${DAOS[o.heart].name} (${DAOS[o.heart].hanzi})` },
    ],
  }));
  return [{ emote: q.npc!, icon: "..." }, named(who.char, who.name, q.brief), { choose: options, prompt: `${K.title}${locked ? ` · a deeper understanding of the ${daoNoun(q.dao)} would show another answer` : ""}` }, ...finish(q, g)];
}

/**
 * What talking to this person does for the Road right now: meeting Qingxu,
 * asking the folk, a question, reading the stele. Null when they have
 * nothing to do with the quest she is on.
 */
export function roadTalk(key: string, g: GameState): Step[] | null {
  const q = currentRoad(g);
  if (!q || q.npc !== key || !["seek", "ask", "koan", "stele"].includes(q.kind)) return null;
  const who = roadPerson(key);
  if (!strongEnough(g, q)) return tooWeak(q, who, g);
  const B = BOOKS[q.dao];
  switch (q.kind) {
    case "seek": {
      const first = q.id === 0;
      return [
        { emote: key, icon: "!" },
        ...(first
          ? [
              named(who.char, who.name, `There you are. Foundation built, and ${{ disciple: "an Azure Cloud sword on your back", foundling: "Hua's girl from Willow Creek, Elder Mo's own disciple now", defector: "the girl who ran from the Blood Moon up the sky bridge, Elder Mo tells me" }[originOf(g.flags)]}. Good. Sit; my knees are older than your sect.`),
              named(who.char, who.name, "Before Lian Qingxue went up, she walked the jianghu ten years, and at ten places she understood one of the Great Daos and carved it in stone. I have copied those ten steles all my life. Someone is eating them."),
            ]
          : [named(who.char, who.name, `${B.place[0].toUpperCase()}${B.place.slice(1)}. The ${["second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][q.book - 1]} stele.`)]),
        named(who.char, who.name, B.keeper),
        { anim: key, name: "point", wait: true },
        narr(B.hollowing),
        { mutate: (s) => completeRoad(s, q.id) },
        { reshape: true },
        { anim: "hero", name: "comprehend", wait: true },
        { toast: `${first ? "A new main quest: the Founder's Road · " : ""}Book ${BOOK_NUMERALS[q.book]}: ${B.title} (${B.hanzi}) · see the Journal (J)` },
      ];
    }
    case "stele":
      return [
        named(who.char, who.name, q.brief),
        { anim: "hero", name: "read", wait: true },
        narr(q.done),
        { flash: GREAT_DAOS[q.dao].colour },
        ...finish(q, g),
        { anim: "hero", name: "comprehend", wait: true },
        { shake: 0.6 },
        { toast: `${ENEMIES[echoOf(q.book)].name} has heard the verse · face it at the stele` },
      ];
    case "koan":
      return koanSteps(q, g);
    case "ask":
    default: {
      const word = wuWord(g, q.dao);
      return [
        { say: "heroine", text: `${who.name}, may I ask you something strange? What does ${daoWord(q.dao)} mean to you?` },
        named(who.char, who.name, q.done),
        ...(word && hash2(q.id, 3, 41) > 0.5 ? [named(who.char, who.name, word)] : []),
        { anim: "hero", name: "nod", wait: true },
        ...finish(q, g),
      ];
    }
  }
}

/** Whether someone wants a word for the Road (the quest she is on is theirs). */
export function roadHasNews(key: string, g: GameState): boolean {
  const q = currentRoad(g);
  return !!q && q.npc === key && ["seek", "ask", "koan", "stele"].includes(q.kind);
}

/** The land a quest sends her to. */
export function roadRegion(q: RoadQuest): AreaId {
  if (q.region) return q.region;
  if (q.landmark) return sightRegion(q.landmark);
  if (q.npc) return roadPerson(q.npc).region;
  return ROAD_SITES[q.book].region;
}

/** The quest line for the HUD and the journal (null before the Road reaches her). */
export function roadLog(g: GameState, locked: (id: AreaId) => string | null = () => null): { chapter: string; title: string; objective: string } | null {
  if (!roadOpen(g)) return null;
  const n = roadDone(g);
  if (n >= ROAD_COUNT) return { chapter: "The Founder's Road", title: "The Canon of Clear Snow", objective: `All ${ROAD_COUNT} steps of the Road are walked and all ten steles stand. Qingxu has gone home to copy them one last time.` };
  const q = roadQuestAt(n);
  const B = BOOKS[q.dao];
  const chapter = `Road · Book ${BOOK_NUMERALS[q.book]}: ${B.title}`;
  const title = `${n + 1}/${ROAD_COUNT} · ${q.title}`;
  if (!strongEnough(g, q) && q.kind !== "comprehend") {
    const need = levelIndex(g.realm, g.stage) < q.level ? realmLabel(...realmOf(q.level)) : `${WU_TIERS[1].name} of the ${GREAT_DAOS[q.dao].name}`;
    return { chapter, title, objective: `The Road asks for ${need} before it will let you on. Cultivate, and sit where the ${daoNoun(q.dao)} runs strong.` };
  }
  const where = roadRegion(q);
  const lock = locked(where);
  if (lock) return { chapter, title, objective: `The Road waits on the way to ${REGION_PLACE[where]}, which is still closed to you: ${lock}` };
  const progress = q.kind === "trial" || q.kind === "contemplate" ? ` (${Math.min(q.count, roadProgress(g))}/${q.count})` : "";
  return { chapter, title, objective: q.objective + progress };
}

/** A hollowed foe put to rest: it counts if the quest wants the hollowed faced. */
export function roadHunt(g: GameState, enemy: EnemyId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentRoad(g);
  if (!q || q.kind !== "trial" || !isHollow(enemy) || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advanceRoad(g);
  if (roadProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${roadProgress(s)}/${q.count}` };
}

/** Breaths at a shrine: they count if the quest wants her to sit in this land. */
export function roadBreath(g: GameState, area: AreaId): { state: GameState; steps: Step[] | null } {
  const q = currentRoad(g);
  if (!q || q.kind !== "contemplate" || q.region !== area || !strongEnough(g, q)) return { state: g, steps: null };
  const s = advanceRoad(g);
  if (roadProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)] };
  return { state: s, steps: null };
}

/** At a landmark: watching the Dao at work, at the hour and in the way the quest wanted. */
export function roadLandmark(landmark: string, g: GameState, how: { night: boolean; riding: boolean; flying: boolean }): Step[] | null {
  const q = currentRoad(g);
  if (!q || q.kind !== "observe" || q.landmark !== landmark || !strongEnough(g, q)) return null;
  const ok = q.how === "any" || (q.how === "night" && how.night) || (q.how === "day" && !how.night) || (q.how === "ride" && how.riding) || (q.how === "fly" && how.flying);
  if (!ok) return null;
  return [...(how.flying || how.riding ? [] : [{ anim: "hero", name: "look", wait: true } as Step]), narr(q.done), ...finish(q, g)];
}

/** Her realm and understanding have caught up: the "beyond your understanding" quest closes itself. */
export function roadCultivated(g: GameState): Step[] | null {
  const q = currentRoad(g);
  if (!q || q.kind !== "comprehend" || levelIndex(g.realm, g.stage) < q.level || wuTier(g, q.dao) < Math.min(2, wuCap(g.realm))) return null;
  return [narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- the Echoes
export function roadPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentRoad(g);
  if (!q || q.kind !== "echo" || echoOf(q.book) !== enemy) return null;
  const e = ENEMIES[enemy];
  const lines: Step[] = [{ shake: 0.4 }, narr(e.intro ?? `${e.name} stands up.`)];
  if (enemy === "kongming") {
    lines.push(
      named("kongming", "Wei Kongming", g.flags["war:won"] ? "You killed Tuoba Hong. He was the only student I ever had who was grateful. He felt the cores, you know. Every one. I envied him." : "My student Tuoba Hong still makes war on your jianghu. I taught him to eat. He was better at it than me: he could taste them."),
      named("kongming", "Wei Kongming", kongmingTaunt(g)),
    );
  }
  const d = dominantDao(g);
  if (d) lines.push({ say: "heroine", text: { sword: "Then I will show you, the only way I know.", mercy: "I will tell you. I will tell you as long as it takes. But first put it down.", balance: "It was never yours to hold. Give it back.", slaughter: "Everything you ate, I will eat out of you." }[d] });
  return lines;
}

/**
 * What the Dao-Eater says of the nine Daos he ate. Each one went into an
 * Echo, and she has met every Echo by the time she reaches him, so he no
 * longer holds them: she set them free, or cut them out, or gave them back,
 * or ate them herself.
 */
function kongmingTaunt(g: GameState): string {
  const eaten = ROAD_DAOS.filter((d) => d !== "void" && g.flags[`devoured:${d}`]).length;
  if (eaten === 9) return "Nine Daos I ate, and you ate every one of them back out of my Echoes. Now you are full and I am empty. Tell me what it feels like, Lin Yue. I have to know.";
  if (eaten > 0) return `Nine Daos I ate, and you took them all back from my Echoes. ${eaten} of them you ate yourself. So we are not so different. Tell me what you feel, and then let us see whose emptiness is larger.`;
  return "Nine Daos I ate, and you sent every one of them home. I felt each one leave me. It was the only thing I have ever felt. Tell me what you feel, Lin Yue, and then let us see whose emptiness is larger.";
}

/** What she may do with an Echo once it is beaten. */
const FATES: { heart: DaoId; label: string; line: (name: string, dao: string) => string }[] = [
  { heart: "mercy", label: "Set it free", line: (n, d) => `She opens her hands. ${n} looks at her a long moment, and then the ${d} it was wearing slips out of it like water out of a sleeve, and it is nobody, and at peace.` },
  { heart: "sword", label: "Cut it apart cleanly", line: (n) => `One stroke. ${n} falls in two halves of nothing, and the Dao it wore spills out and runs home into the stele.` },
  { heart: "balance", label: "Give the Dao back to the land", line: (n, d) => `She lays her palm on the earth and, through it, on ${n}. The ${d} flows out of the Echo and down into the land it was stolen from.` },
  { heart: "slaughter", label: "Eat it, as Kongming did", line: (n, d) => `She opens her mouth and draws, and the ${d} pours out of ${n} into her. It is enormous. It is delicious. It does not feel like understanding at all.` },
];

/** The fates she may give Wei Kongming himself. */
const KONGMING_FATES: { heart: DaoId; label: string; line: string }[] = [
  { heart: "mercy", label: "Sit with him until he feels something", line: "She sits down beside him on the wet stones and tells him what the Daos feel like, one by one, until the tide turns. Somewhere in the eighth he starts to cry, and cannot say why. Qingxu says it is the first thing Wei Kongming has ever felt." },
  { heart: "sword", label: "Give him a cultivator's death", line: "She gives him a clean death, the death of a cultivator, and the void he had begun to swallow bursts out of him like birds out of a cage and flies home across the sea." },
  { heart: "balance", label: "Return the void he ate to the isle", line: "She draws the void out of him, every breath of it he swallowed, and sends it home to the isle on the wind. He is only a man when she is done: a mortal with beautiful handwriting. Qingxu takes him on as a copyist." },
  { heart: "slaughter", label: "Eat the Dao-Eater", line: "She eats him. All of him: the void he swallowed, the hunger, the emptiness. For a moment she understands everything. Then the moment is gone, and the hunger is hers." },
];

/** After an Echo falls: what she does with it, and the land as it is left. */
export function roadVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentRoad(g);
  if (!q || q.kind !== "echo" || echoOf(q.book) !== enemy) return null;
  const e = ENEMIES[enemy];
  const B = BOOKS[q.dao];
  const last = q.id === ROAD_COUNT - 1;
  const noun = daoWord(q.dao);
  const fates = last ? KONGMING_FATES.map((f) => ({ heart: f.heart, label: f.label, line: () => f.line })) : FATES;
  const options: Choice[] = fates.map((f) => {
    const ate = f.heart === "slaughter";
    return {
      label: f.label,
      hint: ate ? `${DAOS[f.heart].name} · a great deal of the ${daoNoun(q.dao)}, and what comes with it` : DAOS[f.heart].name,
      then: [
        { mutate: (s) => walkDao(s, f.heart, 3) },
        narr(f.line(e.name, noun)),
        ...(ate ? ([{ mutate: (s: GameState) => understand(shift(s, CULT.demon, 12), q.dao, 10, true).state }, { mutate: (s: GameState) => ({ ...s, flags: { ...s.flags, [`devoured:${q.dao}`]: true } }) }, { flash: "#2a2440" }] as Step[]) : ([{ mutate: (s: GameState) => understand(s, q.dao, 3).state }] as Step[])),
        ...finish(q, g),
        { reshape: true },
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: ate ? "roar" : "comprehend", wait: true },
        narr(ate ? B.devoured : B.victory),
        ...(last ? roadEnd(ate, ROAD_DAOS.filter((d) => d !== "void" && g.flags[`devoured:${d}`]).length) : [{ toast: `The ${GREAT_DAOS[q.dao].name} ${ate ? "is yours, and the land's no longer" : "comes home"} · Book ${BOOK_NUMERALS[q.book]} of the Road is done` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "domain", wait: true }, narr(`${cap(theFoe(e.name))} kneels on the stones before the stele.`), { choose: options, prompt: `${cap(theFoe(e.name))} is beaten. What becomes of the ${noun} it wears?` }];
}

/** The last stele stands (or the last Dao is eaten): the Road ends. `eaten` is how many of the other nine she ate along the way. */
function roadEnd(ate: boolean, eaten = 0): Step[] {
  const burn = eaten === 9 ? "Ten Daos burn in Lin Yue now, and she cannot feel the edges of any of them." : eaten > 0 ? `The void burns in Lin Yue now, beside the ${eaten === 1 ? "one other Dao" : `${eaten} other Daos`} she ate on the Road, and she cannot feel the edges of any of them.` : "The void burns in Lin Yue now, and the hunger that came with it, and she cannot feel its edges.";
  return [
    { shake: 1 },
    { flash: "#ffffff" },
    {
      narrate: ate
        ? [burn, "Out on Returning Cloud Isle, Daoist Qingxu packs his brushes away without a word and walks back along the causeway alone.", "The jianghu will remember the Founder's Road as the year the steles went quiet."]
        : ["The tenth stele stands on Returning Cloud Isle, and far across the jianghu nine others answer it, one after another, like bells.", "Daoist Qingxu copies the founder's canon one last time, with Lin Yue's hand steadying his wrist.", "Ten Daos, a thousand steps, and one disciple who asked everyone she met what the world meant. The jianghu will be reading her answers for a long time."],
    },
    { mutate: (s) => giveAttire(s, ate ? "hollowrobe" : "clearsnow") },
    { anim: "hero", name: "twirl", wait: true },
    { toast: `The Founder's Road is walked · the ${ate ? "Dao-Eater's Robe" : "Robe of Clear Snow"} is in the wardrobe (V)` },
  ];
}

// ----------------------------------------------------------------------------- everyday words
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills + roadDone(g)) % lines.length];
}

/** What Qingxu says when the quest is not his: by how far the Road has come, and what she understands. */
export function roadNpcScript(key: string, g: GameState): Step[] | null {
  if (!key.startsWith("keeper-")) return null;
  const dao = key.slice(7) as GreatDaoId;
  if (!(ROAD_DAOS as readonly string[]).includes(dao)) return null;
  const speak = (text: string): Step => named(KEEPER.char, KEEPER.name, text);
  const word = wuWord(g, dao);
  return [
    { anim: key, name: "read" },
    speak(pick(g, [
      "Sixty years of copying, and I still get the third line of the water stele wrong. I think the founder meant me to.",
      "Your founder was not a patient woman, you know. The steles are patient. She learned it from them.",
      "Kongming wrote to me once, when he was nineteen. He asked me if I could feel the Dao. I said yes. I should have said: not always.",
      `${roadDone(g)} steps on the Road. I counted. I count everything. It is a copyist's sickness.`,
      "Sit, if you like. The stele does not mind company.",
      "Every stele has a mistake on it somewhere. She left them so we would keep looking.",
    ])),
    ...(word ? [speak(word)] : []),
  ];
}

/** The Road in the journal: each stele as it stands. */
export function roadChronicle(g: GameState): { stele: string; hanzi: string; dao: GreatDaoId; colour: string; state: "waiting" | "hollowed" | "restored" | "devoured" }[] {
  return ROAD_DAOS.map((dao, k) => ({
    stele: `${BOOKS[dao].title} · ${ROAD_SITES[k].name}`,
    hanzi: BOOKS[dao].hanzi,
    dao,
    colour: GREAT_DAOS[dao].colour,
    state: g.flags[`devoured:${dao}`] ? "devoured" : g.flags[`restored:${dao}`] ? "restored" : g.flags[`hollowed:${dao}`] ? "hollowed" : "waiting",
  }));
}

/** The Road's line in the ending, if she walked it. */
export function roadEpilogue(g: GameState): string | null {
  const n = roadDone(g);
  if (n < 1) return null;
  const eaten = ROAD_DAOS.filter((d) => g.flags[`devoured:${d}`]).length;
  if (n >= ROAD_COUNT) {
    if (g.flags["devoured:void"]) return "The founder's steles stood silent along the roads of the jianghu. Cultivators still came to them, and read the words, and felt nothing. Somewhere in the heavens, a woman who had eaten the Dao-Eater wondered why she could not feel the wind.";
    return eaten
      ? `Ten steles stood again along the Founder's Road, ${eaten} of them silent where she had eaten what they said. Qingxu's copies of all ten hang in the Hall of Clouds, and the silent ones are the most read.`
      : "Ten steles stood again along the Founder's Road, and cultivators came from every corner of the jianghu to read them; and beside each one, carved small in a different hand, was a second verse, signed Lin Yue.";
  }
  return `The Founder's Road was still being walked when she stood at heaven's threshold — ${n} of its thousand steps behind her, and Daoist Qingxu waiting at the next stele with his brushes.`;
}
