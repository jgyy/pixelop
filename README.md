# 玉莲飞升 · Jade Lotus Ascension

A **2.5D isometric pixel-art xianxia RPG** built as a full-stack **Next.js 16** web app. You play **Lin Yue**, an inner disciple of the Azure Cloud Sect. Her journey runs across **one continuous open world**: from the floating sect, down a sky bridge to a mortal village, through a haunted bamboo forest and a moonlit lotus lake, into the Crimson Demon Valley to reclaim the stolen Jade Lotus Heart, and finally up to Heavenly Tribulation Peak, where she rises from *Qi Condensation* to *Immortal Ascension*.

**Every pixel is generated procedurally in TypeScript.** The repo contains no image assets for the game. A small z-buffered ray caster draws characters, beasts, trees and buildings from 3D primitives, which gives every character **16 facing directions** for free. A texture painter draws the isometric terrain. The same code runs in the browser, in Node (PNG/GIF export) and in unit tests. The game fills **100% of the screen** at an integer pixel scale.

![Title screen](docs/screenshots/00-title.png)

### One world, no loading screens

The whole jianghu is a single **1296 × 928 tile map**: twice as wide and twice as deep as it was, which was itself twice the world before. The old lands are now its north-western quarter, and **five new regions** lie beyond them (see [The world doubled again](#the-world-doubled-again)). Whistle for **Cloudmane**, Lin Yue's spirit horse, to cover it at a gallop. You can walk from the sect gate down a long sky bridge that rests on Cloudrest Isle half way, along the old highway past the bamboo, and on to the waterfall where the Lotus Lake spills off the edge of the world. South of the highway lie the ashen wastes, a stone forest with a ruined temple, scarecrow fields under a seven-tier pagoda and the snowy highlands with a hot spring and a bandit camp. East of the sect, plank walkways lead out to the floating Cloudstep Isles. Sealed regions sit behind walls of mist, talismans, demonic qi or heaven's light until the story opens them.

![The whole continuous world](docs/art/world-overview.png)

| | |
|---|---|
| ![Sky bridge from the sect](docs/screenshots/16-sky-bridge.png) | ![Running the old highway](docs/screenshots/17-highway-run.png) |
| ![Demonic qi seals the valley](docs/screenshots/18-demonic-seal.png) | ![The Lotus Lake's waterfall](docs/screenshots/19-waterfall.png) |

### Landmarks of the wilds

Each landmark has its own keeper, beasts and treasure, and its name appears in a banner as you walk up to it.

| | |
|---|---|
| ![Cloudrest Isle on the sky bridge](docs/screenshots/20-cloudrest-isle.png) | ![Master Yun on the Cloudstep Isles](docs/screenshots/21-cloudstep-isles.png) |
| ![The crossroads teahouse](docs/screenshots/22-crossroads-teahouse.png) | ![Auntie Fang pours the first cup free](docs/screenshots/23-auntie-fang.png) |
| ![Miller Tang's watermill](docs/screenshots/24-watermill.png) | ![Monk Kong sweeps the Temple of Still Water](docs/screenshots/25-ruined-temple.png) |
| ![The Pagoda of Seven Lamps above the scarecrow fields](docs/screenshots/26-pagoda-fields.png) | ![Xiao Han dozes by the highland hot spring](docs/screenshots/27-hot-spring.png) |
| ![The bandit camp after dark](docs/screenshots/28-bandit-camp-night.png) | ![The Blood Moon camp in the ashen wastes](docs/screenshots/29-blood-moon-camp.png) |
| ![Fighting a mountain bandit](docs/screenshots/30-bandit-battle.png) | ![The grown world map](docs/screenshots/31-world-map-grown.png) |

| Watermill | Bandit camp | Hot spring |
|---|---|---|
| ![](docs/art/site-mill.gif) | ![](docs/art/site-bandits.gif) | ![](docs/art/site-spring.gif) |

![Running the highway](docs/art/highway.gif)

| | |
|---|---|
| ![Opening narration](docs/screenshots/01-opening.png) | ![Intro cutscene](docs/screenshots/02-intro-cutscene.png) |
| ![Elder Mo's briefing](docs/screenshots/03-elder-dialogue.png) | ![Sword flight over the sect](docs/screenshots/04-sect-sword-flight.png) |
| ![World map](docs/screenshots/05-world-map.png) | ![Willow Creek Village](docs/screenshots/06-village.png) |
| ![Hu Li in the bamboo forest](docs/screenshots/07-bamboo-fox-maiden.png) | ![Myriad Swords Return](docs/screenshots/08-battle-myriad-swords.png) |
| ![Moonlit Lotus Lake](docs/screenshots/09-moonlit-lake.png) | ![Meditation](docs/screenshots/10-meditation.png) |
| ![Heavenly tribulation](docs/screenshots/11-heavenly-tribulation.png) | ![Crimson Demon Valley](docs/screenshots/12-demon-valley.png) |
| ![Boss battle with Patriarch Xue](docs/screenshots/13-boss-battle.png) | ![Heavenly Tribulation Peak](docs/screenshots/14-tribulation-peak.png) |

### Riding Cloudmane

With so much more road to cover, Elder Mo hands Lin Yue a jade whistle along with Sword Riding. Press `R` (or the **Ride** button) and Cloudmane, a white spirit horse with a mane of jade cloud, gallops down out of the sky and rears as she mounts. A canter (7.4 tiles/s) already beats running on foot (5.2), and a gallop with `Shift` (11) is twice as fast as the flying sword (5.6). No beast on the road can keep up with her at a gallop. She swings down from the saddle by herself to talk, read, gather, open a chest, meditate, fight or step through a door, and Cloudmane waits in the clouds while she is indoors. The sword is still the way across water. Herds of wild horses graze the fields, the highlands and the lakeside. They bolt if she comes near on foot, but let a rider among them.

| | |
|---|---|
| ![Cloudmane rears as she arrives](docs/screenshots/45-cloudmane-arrives.png) | ![At a gallop down the old highway](docs/screenshots/46-gallop-highway.png) |
| ![Riding among the wild herd](docs/screenshots/47-wild-horses.png) | ![The doubled world on the map](docs/screenshots/50-world-map-doubled.png) |

| Cloudmane and the wild herds | A gallop down the highway |
|---|---|
| ![](docs/art/cloudmane.gif) | ![](docs/art/gallop.gif) |

```mermaid
stateDiagram-v2
  [*] --> OnFoot
  OnFoot --> Riding: R (after Elder Mo's whistle) · rears on arrival
  Riding --> OnFoot: R
  Riding --> OnFoot: talk · read · gather · chest · shrine · battle · cutscene · door
  OnFoot --> Sword: F
  Riding --> Sword: F (steps down first)
  Sword --> OnFoot: F (only over land)
  state Riding {
    [*] --> Canter
    Canter --> Gallop: Shift / joystick pushed all the way
    Gallop --> Canter
  }
  note right of Riding
    walk 3.3 · run 5.2 · sword 5.6
    canter 7.4 · gallop 11 tiles/s
  end note
```

### Step inside

Every building you can enter is **the same size inside as outside**: the room's tile map is exactly the building's footprint in the world, walls included, and the threshold inside lines up with the front door outside. The buildings grew to fit their rooms. The Hall of Clouds and the Pagoda of Seven Lamps are 9 × 9 tiles, and Granny Hua's cottage, the teahouse and the watermill are 8 × 8.

| Outside | Inside |
|---|---|
| ![The Hall of Clouds, 9 × 9 tiles](docs/screenshots/39-hall-outside.png) | ![The same 9 × 9 tiles inside](docs/screenshots/40-hall-inside.png) |
| ![Granny Hua's cottage, 8 × 8 tiles](docs/screenshots/41-cottage-outside.png) | ![The same 8 × 8 tiles inside](docs/screenshots/42-cottage-inside.png) |
| ![The crossroads teahouse, 8 × 8 tiles](docs/screenshots/43-teahouse-outside.png) | ![The same 8 × 8 tiles inside](docs/screenshots/44-teahouse-inside.png) |

```mermaid
flowchart LR
  B["Building on the authoring grid<br/>(hall 3×3, house / teahouse 2×2)"] -- "grown k× about its block's centre<br/>(hall, pagoda k=3 · cottage, mill, teahouse k=4)" --> F["Footprint in the world<br/>footTiles(): 9×9 or 8×8"]
  F --> R["room(): a TileMap exactly that size<br/>walls on i=0 and j=0"]
  F --> D["Front door: middle of the east<br/>(or south) face, one tile out"]
  D --> E["Room exit: the same row (or column)<br/>on the room's open edge"]
  R --> E
```

Five buildings open their doors: the **Hall of Clouds** (the sect's ancestral hall and archive), **Granny Hua's cottage** in Willow Creek, the **crossroads teahouse**, the **watermill** and the **Pagoda of Seven Lamps**. Walk into a door (or press `E` on the step) and the world fades into a cutaway room with plastered walls, lattice windows that let shafts of daylight in (with dust turning in them, fading at dusk), lamplight, and furniture that moves: a crackling stove, a loom whose shuttle flies, a millstone turning on its shaft, incense curling off the altars, candles and seven oil lamps flickering on their own rhythms. Each room has its own folk and its own piece of the story.

| | |
|---|---|
| ![The door of the Hall of Clouds](docs/screenshots/32-hall-door.png) | ![Inside the Hall of Clouds](docs/screenshots/33-hall-of-clouds.png) |
| ![Archivist Shen remembers Xue Ming](docs/screenshots/34-archivist-shen.png) | ![Granny Hua's cottage](docs/screenshots/35-granny-hua-cottage.png) |
| ![Storyteller Qiao's tale of the founder](docs/screenshots/36-teahouse-storyteller.png) | ![Inside the watermill](docs/screenshots/37-watermill-inside.png) |
| ![Sister Ming keeps the seven lamps](docs/screenshots/38-pagoda-of-seven-lamps.png) | ![The folk at home and at work](docs/art/folk-at-work.gif) |

| Hall of Clouds | Granny Hua's cottage | Crossroads teahouse |
|---|---|---|
| ![](docs/art/room-hall.gif) | ![](docs/art/room-cottage.gif) | ![](docs/art/room-teahouse.gif) |

| Watermill | Pagoda of Seven Lamps |
|---|---|
| ![](docs/art/room-mill.gif) | ![](docs/art/room-pagoda.gif) |

### Errands, attire and three new landmarks

The jianghu has more to say. Three new landmarks stand in the wilds, each with its own keeper and story, and four **side errands** run alongside the main quest. They show under the quest tracker as you pick them up, and each ends in a new outfit for Lin Yue. Press `C` (or **Attire**) to change: she twirls into it, and wears it on foot, on Cloudmane, in battle and in her dialogue portrait. Once the Heart is home, Willow Creek holds its first lantern festival in seven years: fireworks burst over the square, the villagers put on their festival best and hold up lanterns, and Little Mei gives her a festival dress.

| | |
|---|---|
| ![The Sword Tomb, where Smith Ou keeps the swords of the fallen](docs/screenshots/51-sword-tomb.png) | ![Smith Ou and Dawnfrost](docs/screenshots/52-smith-ou.png) |
| ![The Moon-Gazing Pavilion and a restless shade](docs/screenshots/53-moon-pavilion.png) | ![Scholar Pei asks her to find his fox](docs/screenshots/54-scholar-pei.png) |
| ![Hu Li comes to the pavilion: the last line of the letter](docs/screenshots/55-the-last-line.png) | ![Auntie Rong's peach orchard](docs/screenshots/56-peach-orchard.png) |
| ![Cloud-silk robes on the Cloudstep Isles](docs/screenshots/57-attire-cloudsilk.png) | ![The wayfarer's cloak at a gallop](docs/screenshots/58-attire-wayfarer-gallop.png) |
| ![Sword-Tomb mail in battle](docs/screenshots/59-attire-mail-battle.png) | ![Little Mei's festival dress](docs/screenshots/60-festival-dress.png) |
| ![A twirl into the festival dress](docs/screenshots/61-festival-twirl.png) | ![Willow Creek's lantern festival](docs/screenshots/62-lantern-festival.png) |

| Lin Yue's wardrobe and Willow Creek's festival best | New moves: salute, twirl, hammer, brush, a drifting shade, a lantern |
|---|---|
| ![](docs/art/attire.gif) | ![](docs/art/new-moves.gif) |

| Sword Tomb | Moon-Gazing Pavilion (night) | Peach Orchard |
|---|---|---|
| ![](docs/art/site-swordtomb.gif) | ![](docs/art/site-pavilion.gif) | ![](docs/art/site-orchard.gif) |

```mermaid
flowchart LR
  subgraph letter["The scholar's letter"]
    pei1["Scholar Pei's shade<br/>(Moon-Gazing Pavilion, after meeting Hu Li)"] --> huli1["Hu Li, beneath the spirit tree"]
    huli1 --> pei2["Hu Li keeps vigil at the pavilion:<br/>the last line, and Pei is at rest"]
    pei2 --> fox(["Foxfire Dress"])
  end
  subgraph brothers["The brothers' quarrel"]
    yun1["Master Yun: a tea brick,<br/>'not an apology'"] --> wen["Old Fisher Wen: a moon-pearl"] --> yun2["Master Yun laughs at last"] --> cloud(["Cloud-Silk Robes"])
  end
  subgraph dawn["Dawnfrost"]
    ou1["Smith Ou at the Sword Tomb"] --> xue["Patriarch Xue's altar:<br/>the sword he never drew"] --> ou2["Dawnfrost goes home"] --> mail(["Sword-Tomb Mail"])
  end
  hua["Granny Hua, once the foxes sleep"] --> cloak(["Wayfarer's Cloak"])
  heart["The Heart returned"] --> fest["Willow Creek's lantern festival:<br/>fireworks, festival clothes"] --> dress(["Lantern Festival Dress"])
  asc["Ascension"] --> cel(["Celestial Raiment"])
  classDef o fill:#241a40,stroke:#f39bc0,color:#fff6dc;
  class fox,cloud,mail,cloak,dress,cel o;
```

### The world doubled again

The map grew to **1296 × 928 tiles** (four times the area), keeping every old road, landmark and save exactly where it was. The old mainland's southern shore now runs on into **the far south**, and the gorge the Lotus Lake's waterfall pours into is spanned by the **Rainbow Bridge**, which carries the old highway across to **the eastern lands**. Five new regions, each with its own name, sky, weather, light, folk, beasts, shrine and treasure, hold sway over the wilds around them:

- **雾泽 The Mistmarsh** (south-west): stilt houses over black pools, boardwalks, will-o'-wisps, koi, hopping dead and Granny Ye, who knows every frog by name.
- **云雾茶山 Cloudmist Tea Terraces** (south): six terraces climbing into the cloud, rows of tea bushes shivering in the wind, pickers, a porter carrying baskets up and down the steps, and Tea Master Lu, who sold Master Yun his tea brick.
- **黄沙海 The Yellow Sands** (south-east): dunes and red rock, an oasis of fan palms, a caravan camp where Batu plays his flute by the fire, and a stupa older than the sect.
- **浪花港 Wavecrest Harbour** (far east): a whole harbour town of houses, stalls, a noodle cart and a teahouse, junks riding at anchor, fish drying on racks, a lighthouse whose beam sweeps the bay, and the sea itself spilling off the edge of the world.
- **霜幕寺 Frostveil Monastery** (north-east): snow pines and stupas, a great hall at the top of the climb, and monks practising taiji barefoot in the snow.

New biomes fill the land between them (marshland, tea hills, plum blossom hills, sand seas, red badlands, maple woods, the eastern steppe, snowfields and the coast), with broad wandering borders and coastlines, and seven new landmarks: the **Rainbow Bridge**, the **Sect Terraces**, the **Herders' Camp** on the steppe, the **Woodcutters' Lodge**, the **Plum Blossom Shrine**, the **Red Cliff Hideout** of the desert raiders and the **Wayside Inn**. The south road runs on from the pagoda hill to the tea terraces, a stone bridge crosses the lava down into the Mistmarsh, and the southern road links the marsh, the inn, the tea road and the Yellow Sands.

**A busier town and sect.** Willow Creek has three more houses and spills down its market road to the highway under a paifang arch: six more houses, stalls, a noodle cart, a fountain, a woodcutter splitting logs, a porter shouldering his pole, children kicking shuttlecocks and a watchman at the arch. The Azure Cloud Sect is moored to three new floating terraces: the **Disciples' Court** (dormitories, a library pagoda, the well and Cook Pang's noodle cart), the **Taiji Yard** where Elder Qiu leads the morning forms, and the **Sword Garden** with its archery targets. Willow Creek has 16 people now, and the sect 18.

**New moves:** hoeing the dikes, chopping firewood, walking under a carrying pole with two swinging baskets, kicking a feathered shuttlecock, strolling under an oiled-paper umbrella, and slow, flowing taiji, which Lin Yue learns from Elder Qiu and practises by herself when left alone. **New animated props:** junks with stirring sails, a turning lighthouse beam, koi circling in ponds, butterflies over wildflowers, shivering tea bushes, fan palms, snow-laden pines, a fountain with a glittering spout, a war drum that booms and shivers, fish swinging on drying racks, stupas with fluttering prayer flags, a steaming noodle cart and a smoking bronze censer, plus stilt houses, archery targets, handcarts and stacks of wine jars. 17 new characters wear the jianghu's faces, from Captain Hai to Abbot Xuan, and a new side errand, **the Sea-Swallow's peach**, earns the **Sea-Swallow Coat**.

| | |
|---|---|
| ![The doubled world on the map](docs/screenshots/63-world-map-doubled-again.png) | ![The Rainbow Bridge over the waterfall's gorge](docs/screenshots/64-rainbow-bridge.png) |
| ![Willow Creek's market road](docs/screenshots/65-willow-creek-market.png) | ![The Disciples' Court on the sect's terraces](docs/screenshots/66-sect-terraces.png) |
| ![Morning forms in the Taiji Yard](docs/screenshots/67-taiji-yard.png) | ![Elder Qiu teaches taiji](docs/screenshots/68-elder-qiu-taiji.png) |
| ![The Mistmarsh at dusk](docs/screenshots/69-mistmarsh.png) | ![Granny Ye and her frogs](docs/screenshots/70-granny-ye.png) |
| ![The Cloudmist Tea Terraces](docs/screenshots/71-tea-terraces.png) | ![Tea Master Lu pours three steeps](docs/screenshots/72-tea-master-lu.png) |
| ![The oasis in the Yellow Sands](docs/screenshots/73-yellow-sands.png) | ![The herders' camp on the steppe](docs/screenshots/74-herders-camp.png) |
| ![Wavecrest Harbour](docs/screenshots/75-wavecrest-harbour.png) | ![Captain Hai and the Sea-Swallow](docs/screenshots/76-captain-hai.png) |
| ![The Sea-Swallow Coat](docs/screenshots/77-sea-swallow-coat.png) | ![Frostveil Monastery in the snow](docs/screenshots/78-frostveil-monastery.png) |
| ![Abbot Xuan's taiji](docs/screenshots/79-abbot-xuan.png) | ![The Plum Blossom Shrine](docs/screenshots/80-plum-blossom-shrine.png) |

| Work and play: hoe, axe, carrying pole, shuttlecock, umbrella, taiji | Wavecrest Harbour | Frostveil Monastery |
|---|---|---|
| ![](docs/art/jianghu-moves.gif) | ![](docs/art/area-harbor.gif) | ![](docs/art/area-frost.gif) |

| The Mistmarsh | Cloudmist Tea Terraces | The Yellow Sands |
|---|---|---|
| ![](docs/art/area-marsh.gif) | ![](docs/art/area-terraces.gif) | ![](docs/art/area-desert.gif) |

```mermaid
flowchart TB
  subgraph old["The old lands (north-west quarter, unchanged)"]
    sect["青云宗 Azure Cloud Sect<br/>+ Disciples' Court · Taiji Yard · Sword Garden"]
    village["柳溪村 Willow Creek<br/>+ the market road"]
    lake["月莲湖 Lotus Lake"]
    pagoda["七灯塔 Pagoda hill"]
    wastes["血月营 Ashen wastes"]
  end
  subgraph south["The far south"]
    marsh["雾泽 Mistmarsh"]
    inn["客栈 Wayside Inn"]
    terr["云雾茶山 Tea Terraces"]
    plum["梅花祠 Plum Blossom Shrine"]
    sands["黄沙海 Yellow Sands"]
  end
  subgraph east["The eastern lands"]
    bridge["虹桥 Rainbow Bridge"]
    steppe["牧民营 Herders' Camp"]
    lodge["伐木屋 Woodcutters' Lodge"]
    frost["霜幕寺 Frostveil Monastery"]
    cliff["赤崖寨 Red Cliff Hideout"]
    harbor["浪花港 Wavecrest Harbour"]
  end
  village -- "market road" --> hw(["the old highway"])
  hw -- "over the gorge" --> bridge --> steppe --> harbor
  steppe -- "north into the snows · seal: Foundation" --> frost
  steppe --> lodge --> cliff
  lodge --> sands
  pagoda -- "south road" --> terr
  wastes -- "stone bridge over the lava" --> marsh
  marsh -- "southern road" --> inn --> terr
  inn --> plum
  terr --> sands
  lake -. "waterfall into the gorge" .-> bridge
  harbor -. "the sea spills off the world's edge" .-> clouds((clouds))
  classDef n fill:#241a40,stroke:#f2c55c,color:#fff6dc;
  class marsh,terr,sands,harbor,frost n;
```

```mermaid
flowchart LR
  qiu["Elder Qiu · Taiji Yard"] -- "taiji: +30% of a stage" --> you((Lin Yue))
  pang["Cook Pang · Disciples' Court"] -- "breakfast: full HP/QI + a Healing Pill" --> you
  ye["Granny Ye · Mistmarsh"] -- "untangled qi: +30% + 2 Qi Pills" --> you
  lu["Tea Master Lu · Tea Terraces"] -- "three steeps: full HP/QI, +35%" --> you
  batu["Batu · Yellow Sands"] -- "a song: 30 spirit stones" --> you
  xuan["Abbot Xuan · Frostveil"] -- "the Frostveil form: +60%" --> you
  altan["Herder Altan · steppe"] -- "mare's milk: full HP/QI" --> you
  alan["Fishwife Ah Lan · harbour"] --> shop[("pills for sale")]
  zhao["Innkeeper Zhao · Wayside Inn"] -- "a night's rest" --> shop
  hai1["Captain Hai: a peach for his mother"] --> rong["Auntie Rong's oldest tree"] --> hai2["Captain Hai"] --> coat(["Sea-Swallow Coat"])
```

### Three sects, the deep, and choices that matter

The south and east now belong to **three sects**, each with its own compound on its own heights, its own folk, its own trouble and its own cave beneath it. Lin Yue settles their troubles **her way**: conversations now put questions to her (pick with `1`–`5`, the arrow keys or a click), and every answer is remembered. Answers move each sect's **standing** with her (Hostile · Wary · Neutral · Friendly · Allied), decide who lives where, what she is given, how the tale ends, and **change the land itself**: lava breaks out of a mesa, a marsh drains into fields, a buried cave mouth shakes loose, a spring breaks from a mountain.

- **赤凰门 The Scarlet Phoenix Sect** stands on a sheer red **mesa** (seven levels up a stone stair) with a lava pool in its crown. Sect Mistress Yan Huo's miners are trapped in the **Ember Mine** beneath it, where something made of fire is singing. Bow, provoke her into a sparring match, or name a price; lead the miners out first or leave them hidden while you hunt (they may not all come out whole); then **seal the burning vein** (the lava in the mine and the mesa's crown turns to stone) or **feed it to the Phoenix** (the crown boils over and a river of lava pours down the eastern cliffs).
- **百草谷 Hundred Herb Valley** lies sheltered in a **ring of hills** south of the Mistmarsh, its garden withered to dirt and dead stalks. In the **Sunken Grotto** beneath it, Bai Zhi's expelled student Ku Shen is poisoning the spring: **fight him** or **let him go** (he turns up later at the Wayside Inn, selling honest pills), then **purify the spring with your own qi** (it drains you; lotuses bloom) or **drain the Mistmarsh's black pools** (they become fields, and a sunken chest surfaces in the grotto). Either way the valley turns green again.
- **剑海阁 The Sword Sea Pavilion** sits on a **crag ten levels high** above the eastern snows. Someone is selling its sword manuals to the Blood Moon's leftovers. Gather the clues, confront the thief, then **expose him** (he is expelled and goes home to mend nets at the harbour), **make him confess himself** (he sweeps the ten thousand steps as penance) or **take his silver** (the Pavilion turns against you, and he comes back wearing a Blood Moon crescent). The heaped rock on the old stair down to the **Sword Sea** ledge is cleared only if justice is done.
- **龙脉 The Dragon Vein.** Settle two sects' troubles and the **Dragonspine** shakes: the rockfall over its cave mouth slides away and the sects fly in from three directions. Deep in the **Dragon Vein Caverns**, at the glowing heart of the vein, the spirit **Old Long** makes her choose who gets it: the Phoenix (a smoking crater opens on the mountain), the Valley (the Dragonspine blooms green), the Pavilion (a stone sword rises from the summit), **no one** (a spring breaks out and runs down the mountain for everyone), or **herself** (her cultivation surges, the mountain turns to ash, and every sect turns against her). Elder Mo, the ending and the folk all remember what she chose.
- **The old tale has choices too:** before the last fight, Lin Yue can offer Patriarch Xue a way home. He refuses, but his last words change, and so does the ending.

| | |
|---|---|
| ![The Dragonspine, its cave mouth buried under rockfall](docs/screenshots/82-dragonspine-buried.png) | ![The Scarlet Phoenix on its mesa](docs/screenshots/83-phoenix-mesa.png) |
| ![Yan Huo asks how she will answer](docs/screenshots/84-yan-huo-choice.png) | ![Down in the Ember Mine](docs/screenshots/85-ember-mine.png) |
| ![The trapped miners: lead them out, or hunt first?](docs/screenshots/86-trapped-miners.png) | ![The Ember Wyrm, fought on a ledge in the dark](docs/screenshots/87-ember-wyrm-battle.png) |
| ![The burning vein: seal it, or feed it?](docs/screenshots/88-burning-vein-choice.png) | ![Fed: the mesa's crown boils over down the cliffs](docs/screenshots/89-mesa-ablaze.png) |
| ![Hundred Herb Valley, withered](docs/screenshots/90-herb-valley-withered.png) | ![The Sunken Grotto](docs/screenshots/91-sunken-grotto.png) |
| ![Ku Shen at the poisoned spring](docs/screenshots/92-ku-shen-choice.png) | ![Purify the spring, or drain the marsh?](docs/screenshots/93-poisoned-spring-choice.png) |
| ![The valley blooms again](docs/screenshots/94-herb-valley-blooms.png) | ![The Sword Sea Pavilion on its crag](docs/screenshots/95-sword-sea-pavilion.png) |
| ![Jian Wuyou's confession](docs/screenshots/96-jian-wuyou-choice.png) | ![The stair to the Sword Sea, cleared](docs/screenshots/97-stair-to-the-sword-sea.png) |
| ![The Dragon Vein Caverns](docs/screenshots/98-dragon-vein-caverns.png) | ![The conclave: who gets the vein?](docs/screenshots/99-the-conclave.png) |
| ![Shared: a spring runs from the Dragonspine](docs/screenshots/100-dragonspine-spring.png) | ![The journal (J): quests, rumours and every sect's standing](docs/screenshots/101-journal.png) |

| Ember Mine | Sunken Grotto | Dragon Vein Caverns |
|---|---|---|
| ![](docs/art/cave-emberMine.gif) | ![](docs/art/cave-grotto.gif) | ![](docs/art/cave-vein.gif) |

| Scarlet Phoenix Sect | Hundred Herb Valley | Sword Sea Pavilion |
|---|---|---|
| ![](docs/art/site-phoenix.gif) | ![](docs/art/site-herbvalley.gif) | ![](docs/art/site-swordsea.gif) |

| On the Dragonspine's summit, twelve levels up | Among the frost peaks |
|---|---|
| ![](docs/screenshots/103-dragonspine-summit.png) | ![](docs/screenshots/104-frost-peaks.png) |

| New moves: the pick, the torch, the brew, fire palm, kowtow, sword dance, cowering; the Ember Wyrm and the Stone Hound | The mountains on the world map |
|---|---|
| ![](docs/art/deep-moves.gif) | ![](docs/screenshots/102-world-map-mountains.png) |

```mermaid
flowchart TD
  subgraph phx["赤凰门 Embers Beneath the Mesa"]
    y1{"Yan Huo: how do you answer?"} -- "bow (+1)" --> m1
    y1 -- "provoke: spar with Zhu Que" --> m1
    y1 -- "name a price (stones later)" --> m1
    m1{"Trapped miners"} -- "lead them out first (+1)" --> w1
    m1 -- "hide them, hunt now (Ah Shi is burned)" --> w1
    w1(["Ember Wyrm"]) --> v1{"The burning vein"}
    v1 -- "seal it" --> s1["mine and mesa crown turn to stone<br/>Phoenix ≤ 0 · Valley +1"]
    v1 -- "feed it" --> f1["lava pours down the mesa<br/>Phoenix +2 · Valley −1 · Phoenix Plumage"]
  end
  subgraph herb["百草谷 The Withering Garden"]
    k1{"Ku Shen at the spring"} -- "fight" --> c1["captured (+1)"]
    k1 -- "let him go" --> c2["sells pills at the Wayside Inn"]
    c1 & c2 --> sp{"The poisoned spring"}
    sp -- "purify with your own qi" --> p1["HP/QI drained · lotuses (+2)"]
    sp -- "drain the marsh" --> p2["black pools become fields<br/>a sunken chest surfaces (+1)"]
    p1 & p2 --> bloom["the withered valley turns green · Hundred Herb Robe"]
  end
  subgraph swd["剑海阁 The Thief of Ten Thousand Swords"]
    cl["2 clues: Tang Yu, the old stair"] --> j1{"Jian Wuyou"}
    j1 -- "expose him (+2)" --> e1["expelled → mends nets at the harbour<br/>stair cleared"]
    j1 -- "make him confess (+1)" --> e2["sweeps the ten thousand steps<br/>stair cleared"]
    j1 -- "take his silver (−3)" --> e3["+120 stones · stair stays buried<br/>he returns as a Blood Moon swordsman"]
  end
  phx & herb & swd -- "any two settled" --> quake(["the Dragonspine shakes:<br/>the rockfall slides off the cave mouth"])
  quake --> long{"Old Long: who gets the Dragon Vein?"}
  long -- Phoenix --> o1["a crater smokes on the summit"]
  long -- Valley --> o2["the Dragonspine blooms"]
  long -- Pavilion --> o3["a stone sword rises"]
  long -- "no one" --> o4["a spring for everyone · all +1"]
  long -- herself --> o5["power · ash · every sect hostile"]
  o1 & o2 & o3 & o4 & o5 --> ending(["Elder Mo and the ending remember"])
  classDef c fill:#241a40,stroke:#f2c55c,color:#fff6dc;
  class y1,m1,v1,k1,sp,j1,long c;
```

#### Terrain of many heights, and a land that answers the story

The wilds are no longer gentle hills. Eight **mountain ranges** are thrown up over the world with ridged noise (the Dragonspine, the frost peaks, the red mesas, the herb valley's rim…), rising to **12 levels**, snow-capped (or bare red rock in the dry lands) at the top, and easing down to meet every road, river and region so the jianghu stays walkable. The sects stand on **plateaus with sheer cliffs** reached by long stone stairs that climb a level every few tiles.

Every change the story makes to the land is a **terrain patch**: a recorded set of tile changes (ground, height, blocking) that holds while a condition on the story flags holds. Patches are laid over the shared tile map and taken back off when a different save is loaded, so the land always matches the story being played. When one changes in view the ground shakes, dust (or steam, or spray) rises over the changed tiles, and if the ground under her turns to lava or rock she is stepped out onto open ground.

```mermaid
flowchart LR
  B["World generation<br/>(continent.ts, caves.ts)"] -- "PatchPainter: disc / path / set<br/>records kind · height · block per tile" --> P[("TerrainPatch<br/>key · when(flags) · tile diffs")]
  F["Story flags in the save<br/>phx:fed · herb:drained · veinOpened · vein:shared…"] --> S
  P --> S["syncTerrain(def, flags)<br/>applyPatches: undo all (newest first),<br/>re-apply those that hold, in order"]
  S -- "changed tiles" --> C["throw away painted columns<br/>of each tile and its neighbours"]
  S -- "changed in view" --> Q["quake · dust / steam / spray<br/>step her out of new lava or rock"]
  S --> M["the shared TileMap<br/>(collision, rendering, world map)"]
  G["Game: on load, every 0.5 s,<br/>a { reshape } step, entering a room"] --> S
```

#### Underground

Three caves lie under the sects' lands, each a map of its own (like the rooms indoors, but up to 60 × 60 tiles) entered through a cave mouth in the open world. A cave is a **cutaway of living rock**: chambers and tunnels at many heights joined by climbing passages, a rock face behind them, and cliffs dropping into darkness in front, under a ceiling of stalactites that drip. Lava runs in channels, an underground lake spills off a ledge, mine rails cross the halls, and the only light is her torch (she holds it up whenever she stands still), the torches on the walls, glowing mushrooms, crystals and fire-jade. Fights underground are staged on a ledge in the dark.

```mermaid
flowchart LR
  subgraph world["The open world"]
    em(["minemouth at the mesa's foot"])
    gm(["cave mouth in the herb valley"])
    vm(["cave mouth on the Dragonspine<br/>buried until veinOpened"])
  end
  em --> E["炎晶矿 Ember Mine<br/>rails · minecarts · lava channels<br/>trapped miners · Ember Wyrm · the burning vein"]
  gm --> G["沉渊洞 Sunken Grotto<br/>glowing mushrooms · an underground lake<br/>Ku Shen · the poisoned spring"]
  vm --> V["龙脉窟 Dragon Vein Caverns<br/>crystal galleries · stone hounds · a river into the dark<br/>the vein's heart · the conclave"]
  E & G & V -- "carve(): chambers + rising tunnels,<br/>rock walls behind, cliffs in front" --> R["a room of the World runtime<br/>(rooms.ts: buildings and caves)"]
```

### The turning year, a thousand notices and a wardrobe

The jianghu now keeps a **calendar**. Day, night and the **four seasons** follow the save's own clock (two days to a season, eight to a year), so a game left at midnight in winter is still midnight in winter when you come back. The sun and the moon cross the sky behind the mountains, dawn and dusk wash the land gold, and midnight is truly dark but for the lamps and the lanterns the folk carry. The calendar sits in the corner of the screen.

| Spring | Summer |
|---|---|
| ![Willow Creek in spring: fresh green and blossom on the wind](docs/screenshots/105-spring-village.png) | ![Summer: deep green](docs/screenshots/106-summer-village.png) |
| ![Autumn: the grass turns gold, the willows burn orange, leaves pile up and persimmons dry](docs/screenshots/107-autumn-village.png) | ![Winter: snow on the ground and the roofs, a snowman, and the folk in their wool](docs/screenshots/108-winter-village.png) |
| ![Dawn's golden hour](docs/screenshots/109-dawn-golden-hour.png) | ![Midnight: the folk carry lanterns](docs/screenshots/110-night-lanterns.png) |
| ![A summer shower on the tea terraces](docs/screenshots/111-summer-shower.png) | ![Autumn in the bamboo, in the Autumn Maple Robe](docs/screenshots/122-autumn-maple-robe.png) |

| The year in Willow Creek's square, from noon through dusk and midnight to dawn, in every season |
|---|
| ![](docs/art/seasons.gif) |

- **Seasons on the land.** A pixel filter turns the painted greens of every tree, bush and lawn with the year: fresh and blossom-flecked in spring, deep in summer, gold and red in autumn, grey and snow-capped in winter (with snow on every roof, rock and stele, snow lying on the ground and a lip of it over every cliff edge, thinner on paths and paving). Evergreens keep their needles. Only the temperate lands turn: the Yellow Sands stay dry, Frostveil is always under snow, and the demon valley and the peak answer to no season at all. The filtered sprites are cached beside the originals, so the art is painted once.
- **Weather of the season:** blossom on the spring wind, summer **showers** (rain streaks with a splash where each drop lands, a greyer sky, and lightning in a heavy one), fireflies on summer nights, falling leaves in autumn, and snow all winter. A banner and a gust of petals, leaves or snow mark the day the season turns.
- **The folk live by the hour and the season:** they put on **winter wool** (a shawl and a hood for anyone who has no winter clothes of their own), carry **lanterns** after dark and open **umbrellas** in the rain, and when they stand about they plant rice and fly kites in spring, rake leaves in autumn, shiver, warm their hands and throw snowballs in winter, and yawn or gaze at the stars at night. So does Lin Yue. Snowmen, leaf piles, persimmons drying under the eaves and beds of rice seedlings come and go in Willow Creek with the season.

| Lin Yue's new moves through the year | The Almanac Master, the four Wardens, the new outfits and the folk in winter wool |
|---|---|
| ![](docs/art/year-moves.gif) | ![](docs/art/wardens.gif) |

#### Main quest: the Turning of the Year

A second thread of the main tale begins once Willow Creek is safe. **Almanac Master Shi** keeps the calendar beside a bronze **sundial** in the village square (its gnomon's shadow follows the hour). While the Jade Lotus Heart was gone, the **Four Wardens of the Year** fell asleep, and the seasons have been turning hollow. Lin Yue wakes each one in its own season, at its own place and hour, with the offering of its festival. Turn the almanac by the sundial to wait for dawn, nightfall or the next season.

```mermaid
flowchart LR
  S["Almanac Master Shi<br/>(Willow Creek, after Head Zhou)"] --> SP & SU & AU & WI
  subgraph SP["Spring · 清明 Qingming"]
    sp1["Sweep the graves at the Sword Tomb"] --> sp2["Plum Blossom Shrine at dawn:<br/>Lady Qingming wakes"]
  end
  subgraph SU["Summer · 端午 / 夏至"]
    su1["Zongzi from Noodle Seller Hu (harbour)"] --> su2["Rainbow Bridge at noon:<br/>Lord Xiazhi wakes"]
  end
  subgraph AU["Autumn · 中秋 Mid-Autumn"]
    au1["Mooncakes from Cook Pang (sect)"] --> au2["Moon-Gazing Pavilion at night:<br/>Grandmother Shuangjiang wakes"]
  end
  subgraph WI["Winter · 冬至 Dongzhi"]
    wi1["Tangyuan from Granny Hua"] --> wi2["Highland Hot Spring in the depth of night:<br/>Old Dongzhi wakes"]
  end
  SP & SU & AU & WI --> F(["Back to Shi: the year made whole<br/>Raiment of the Four Seasons"])
  D[/"The sundial: wait for dawn,<br/>nightfall or the next season"/] -.-> SP & SU & AU & WI
```

| | |
|---|---|
| ![Almanac Master Shi](docs/screenshots/112-almanac-master.png) | ![Turning the almanac by the sundial](docs/screenshots/113-sundial-almanac.png) |
| ![Lady Qingming, Warden of Spring, at the Plum Blossom Shrine at dawn](docs/screenshots/114-warden-of-spring.png) | ![Old Dongzhi, Warden of Winter, at the hot spring on the longest night](docs/screenshots/115-warden-of-winter.png) |

#### A thousand notices

The folk of the jianghu have **1000 favours** to ask (a dozen or so each, from 86 people in every region). Anyone with a ✉ scroll over their head has one: take it or leave it, and carry up to three at once. They are composed the same way every time from who asks, where they live, what they want and the roads and beasts in between, so nothing but a bit per notice goes into the save.

| Kind | What she does |
|---|---|
| Delivery | Carry a jar of plum wine, a love letter or a cricket in a cage to someone else (a parcel marker hangs over them) |
| Hunt | Beat 1–3 of a land's beasts (wolves, serpents, jiangshi, bandits, cultists) in that land |
| Visit | Go to a landmark and burn incense, copy an inscription, play the dizi or practise a sword form there |
| Night watch | The same, after dark |
| By horse / by sword | Arrive on Cloudmane, or on the flying sword |
| In season | Arrive in spring, summer, autumn or winter (the almanac helps) |
| Stillness | Meditate a number of breaths at a land's lotus shrine |

Rewards grow with the distance, and milestones bring outfits: **Ranger's Leathers** at 10 notices, **Night Heron Silks** at 50, a **Candidate's Robes** at 150, the **Moon Rabbit Dress** at 400 and **Empress of the Jianghu** at all 1000. The journal (`J`) lists the notices she carries (and lets her set one aside), and counts the ones done.

```mermaid
stateDiagram-v2
  [*] --> Offered: talk to someone with a ✉ scroll<br/>(first undone notice whose lands are open)
  Offered --> Carried: Take the notice (3 slots)
  Offered --> [*]: Not now
  Carried --> Carried: progress (beasts beaten · breaths at a shrine)
  Carried --> Fulfilled: parcel handed over · landmark reached<br/>(at night · on Cloudmane · on the sword · in season)
  Carried --> [*]: Set aside (journal)
  Fulfilled --> [*]: stones · cultivation · a pill now and then<br/>milestone outfits at 10 · 50 · 150 · 400 · 1000
```

| | |
|---|---|
| ![Scrolls over the heads of folk with a favour to ask](docs/screenshots/116-notice-scrolls.png) | ![Ah Bao asks a favour](docs/screenshots/117-notice-offer.png) |
| ![The journal: the year, the notices, the sects](docs/screenshots/118-journal-notices.png) | ![The wardrobe: every outfit, and how to earn the rest](docs/screenshots/119-wardrobe.png) |

#### The wardrobe

Press `V` (or **Attire**) to open the **wardrobe**: all 21 outfits, the ones she owns to put on with a click, and a hint for each one she hasn't earned yet. `C` still changes into the next one. Ten are new: the four Wardens' gifts (Spring Blossom Hanfu, Summer Lotus Gauze, Autumn Maple Robe, Snow-Fox Cloak), the Raiment of the Four Seasons, and the five notice milestones.

| | |
|---|---|
| ![The Raiment of the Four Seasons in the winter square](docs/screenshots/120-four-seasons-raiment.png) | ![The Snow-Fox Cloak at Frostveil](docs/screenshots/121-snow-fox-cloak-frostveil.png) |

**Fixes:**
- the hour of the day was reset to noon every time a game was loaded (the cycle ran off the session's clock); it now follows the save
- quitting to the title threw away everything since the last autosave (up to a minute); the game now saves first
- a healing or qi pill swallowed at full strength was wasted, in the field and in battle (where it also cost a turn); now she refuses it
- buying a pill with a full gourd (99) said "Not enough spirit stones"
- midnight was barely darker than dusk; night now deepens properly after sunset

### Three beginnings, a Heart to choose, and five endings

The main quest branches now, from the first screen to the last. **Begin Cultivation** asks where Lin Yue's tale begins, and each beginning has its own opening scene, its own way into the story, its own answer for Patriarch Xue and its own place in the ending. At Xue's altar the fight is no longer the only way, and once the **Jade Lotus Heart** is in her hands she decides what it is for. Three of those answers change the land for good, one of them turns Elder Mo against her, and the last choice of all comes at the top of heaven's stair.

| | |
|---|---|
| ![Where does her tale begin? The three beginnings](docs/screenshots/123-origin-picker.png) | ![The foundling wakes in Willow Creek to Granny Hua and a red moon](docs/screenshots/124-foundling-granny-hua.png) |
| ![The Blood Moon runaway at the sect gate](docs/screenshots/125-defector-at-the-gate.png) | ![Swear an oath to Elder Mo, or tell him the secret way into the valley](docs/screenshots/126-defector-swears-or-tells.png) |

| Beginning | Starts | What it changes |
|---|---|---|
| **Inner Disciple** 内门弟子 | in the floating sect, to the alarm bells (the classic opening) | can recite the founder's sutra at Xue, shaking his qi (he starts the fight 20% down) |
| **Willow Creek Foundling** 柳溪孤女 | in Granny Hua's house in Willow Creek, homespun clothes, four healing pills and almost no money | fights the maddened fox on the first night, before she has ever seen the sect, then climbs the sky bridge with an outer-sect token; Elder Mo takes her as his disciple on the spot; Granny Hua, Head Zhou and Xue himself speak to her as one of the village; she can always talk Xue Ming home; she may go home at the very end |
| **Blood Moon Runaway** 血月叛徒 | at the sect gate in Blood Moon robes, rich in stones and qi pills, with Disciple Guo's sword at her throat | chooses what to give Elder Mo: an oath on the founder's stele (his trust and the storerooms) or the **secret way** into the Crimson Demon Valley (the valley opens at Foundation without the Serpent King or the lake); knows the old wound in Xue's art and strikes it first (he starts the fight 40% down) |

```mermaid
flowchart TD
  O{{"Begin Cultivation:<br/>where does her tale begin?"}} --> D["Inner Disciple<br/>wakes in the sect"] & F["Willow Creek Foundling<br/>wakes in the village · fox at the bridge"] & R["Blood Moon Runaway<br/>at the sect gate in Blood Moon robes"]
  D & F --> M["Elder Mo: Sword Riding,<br/>Cloudmane's whistle"]
  R --> RM{"Elder Mo doubts her"}
  RM -- "swear on the stele" --> T["his trust · 40 stones · 4 pills"] --> M
  RM -- "tell him the secret way" --> W["the valley opens at Foundation<br/>(no lake, no Serpent King)"] --> M
  M --> CH["Chapters I–IV<br/>(the fox, the bamboo, the lake, the tribulation)"]
  W -.->|the shortcut| X
  CH --> X{"Patriarch Xue at his blood altar"}
  X -- "offer him a way back / draw your sword" --> B["battle"]
  X -- "disciple: recite the founder's sutra" --> B2["battle, Xue 20% down"]
  X -- "runaway: strike the old wound" --> B3["battle, Xue 40% down"]
  X -- "foundling, or one who knows his past (Shen + Ou):<br/>speak of Willow Creek and Dawnfrost" --> RX["no fight: Xue kneels<br/>and lays the Heart down himself"]
  B & B2 & B3 & RX --> H{"The Jade Lotus Heart<br/>is in her hands"}
  H -- "carry it home" --> HOME["Elder Mo · the shrine"]
  H -- "plant it in the valley" --> PL["the valley blooms for good<br/>Lotus Sovereign Gown"] --> HOME
  H -- "drink it" --> DV["the blood moon spreads<br/>Blood Moon Sovereign form"] --> MO{"Elder Mo in the Hall of Clouds<br/>(boss battle)"}
  MO -- "break his cultivation" --> MB["the hall is scorched<br/>Mo sweeps it, a mortal"] --> PEAK
  MO -- "lower your blade" --> PU["Mo draws the Heart out of her<br/>(her cultivation spent, the land heals)"] --> HOME
  HOME --> PEAK["Heavenly Tribulation Peak<br/>nine bolts"]
  PEAK --> E{"Heaven's stair"}
  E -- "climb (Heart at home)" --> E1(["Immortal Ascension"])
  E -- "climb (Heart planted)" --> E2(["The Lotus Takes Root"])
  E -- "turn your back on heaven" --> E3(["Guardian of the Jianghu"])
  E -- "foundling: go home" --> E4(["The Road Home"])
  PEAK -- "the Heart drunk, Mo broken" --> E5(["The Blood Moon Sovereign"])
  classDef fin fill:#241a40,stroke:#f2c55c,color:#fff6dc;
  class E1,E2,E3,E4,E5 fin;
```

| | |
|---|---|
| ![Four answers at Xue's altar, one without a fight](docs/screenshots/127-xue-four-answers.png) | ![Xue Ming lays the Heart down himself](docs/screenshots/128-xue-lays-down-the-heart.png) |
| ![The Heart's fate: home, the land, or her](docs/screenshots/129-the-hearts-fate.png) | ![The Heart takes root: the demon valley turns green, the lava to water](docs/screenshots/130-the-lotus-takes-root.png) |
| ![Xue Ming at the Sword Tomb, oiling the swords of the fallen](docs/screenshots/131-xue-ming-at-the-sword-tomb.png) | ![Blood moon over the blighted bamboo, in the Blood Moon Sovereign form](docs/screenshots/132-blood-moon-over-the-bamboo.png) |
| ![Blood moon over Willow Creek, its paddies withered](docs/screenshots/133-blood-moon-over-willow-creek.png) | ![Elder Mo, the new boss of the crimson road](docs/screenshots/134-elder-mo-battle.png) |
| ![The Hall of Clouds scorched where Mo knelt](docs/screenshots/135-the-hall-of-clouds-scorched.png) | ![Heaven's stair: climb, turn back, or go home](docs/screenshots/136-heavens-stair.png) |
| ![Guardian of the Jianghu: moss and blossom through the peak's snow](docs/screenshots/137-guardian-of-the-jianghu.png) | ![Hu Li's gift: the Nine-Tailed Form](docs/screenshots/138-nine-tailed-form.png) |
| ![The wardrobe with the new forms](docs/screenshots/139-wardrobe-forms.png) | ![The Dragon-Blood Form](docs/screenshots/140-dragon-blood-form.png) |

#### Choices that change the land for good

Five new terrain patches and four new skies (26 patches in all, laid over the shared map from the save's flags, so they come and go with the save being played):

| Choice | The land | The sky |
|---|---|---|
| Xue talked home | the valley's lava rivers cool to clear water, moss creeps over the ash; most of the cultists and the hopping dead go home; Xue Ming appears at the Sword Tomb | the blood moon sets: an ordinary dusk with fireflies |
| The Heart planted | the whole Crimson Demon Valley turns to meadow, lotus opens on every pool that was lava, peach and cherry trees and butterflies on the banks | a clear day with blossom on the wind |
| The Heart drunk | the Whispering Bamboo goes grey and red, Willow Creek's paddies wither to cracked earth, dead trees in both (all of it undone if Mo draws the Heart back out) | the blood moon rises over the bamboo and Willow Creek |
| Elder Mo broken | the marble before the Hall of Clouds is scorched black; Mo stays, an old mortal in grey with a broom | a storm over the sect |
| Guardian ending | moss and blossom push up through the peak's snow, cherry trees round the dais | |
| The road home | lanterns and banners for the new school in Willow Creek's hall | |

The battle arenas wear the sky the story has left, too.

#### Nine new things to wear, and seven new gestures

The wardrobe holds **30 outfits** now. Two come with a beginning (**Willow Creek Homespun**, **Blood Moon Acolyte's Robes**), five are woven by the main quest's choices (**Xue Ming's Outer-Sect Robe** if he comes home, the **Lotus Sovereign Gown** for a planted Heart, the **Blood Moon Sovereign** for a devoured one, with silver hair and red eyes, the **Earth Immortal's Mantle** for the guardian, the **Village Teacher's Robe** for the road home), and two are shapes she can take: Hu Li makes her sworn sister a fox spirit with the **Nine-Tailed Form** once the Blood Moon is over and Pei is at rest, and drinking the Dragon Vein leaves her the **Dragon-Blood Form** (jade hair, golden eyes). Heaven's own raiment is now woven only for those who climb its stair.

New animations, for Lin Yue (53 now) and the folk: **offer** (both hands held out, the Heart or a gift), **think** (a hand to the chin), **shrug**, **cry**, **levitate** (rising on a column of qi), **roar** (a crouch, then arms flung wide, eyes glowing) and **plantsword** (a sword driven into the earth, kneeling behind it). Elder Mo, Patriarch Xue, Granny Hua, Head Zhou, Hu Li, Smith Ou, Ah Bao and the villagers use them in the new scenes and when they stand about.

| The new gestures | The new outfits and forms |
|---|---|
| ![](docs/art/turning-gestures.gif) | ![](docs/art/forms.gif) |

**Fixes:**
- every pill shop said "Alchemy Hall Wares" and "Farewell, Senior Sister", even Peddler Bai's, Auntie Fang's, the innkeeper's and Ku Shen's; the shop is now named for whoever is selling
- Patriarch Xue's last words called her "a child of Foundation" whatever realm she had reached
- Elder Mo had news about the Dragon Vein but no marker over his head to say so
- Elder Mo always thanked her for Old Fisher Wen's message, even when she had never met Wen
- battles in the valley still showed the blood moon after the story had lifted it

### Animated art

| Lin Yue's 53 animations | All 16 facing directions |
|---|---|
| ![Heroine move set](docs/art/heroine-moves.gif) | ![Heroine 16 directions](docs/art/heroine-16dir.gif) |

| The cast (turning on the spot) | Bestiary |
|---|---|
| ![Cast](docs/art/cast.gif) | ![Bestiary](docs/art/bestiary.gif) |

| Azure Cloud Sect | Willow Creek Village | Whispering Bamboo Forest |
|---|---|---|
| ![](docs/art/area-sect.gif) | ![](docs/art/area-village.gif) | ![](docs/art/area-bamboo.gif) |

| Moonlit Lotus Lake | Crimson Demon Valley | Heavenly Tribulation Peak |
|---|---|---|
| ![](docs/art/area-lake.gif) | ![](docs/art/area-valley.gif) | ![](docs/art/area-peak.gif) |

| Pastimes: the dizi flute, a bowl of noodles, juggling and a fan | Festival lanterns and a kite over Willow Creek |
|---|---|
| ![Pastimes](docs/art/pastimes.gif) | ![Lanterns and a kite](docs/screenshots/48-village-lanterns-kite.png) |

| World map (a miniature of the real world) | Dialogue portraits |
|---|---|
| ![World map](docs/art/worldmap.gif) | ![Portraits](docs/art/portraits.png) |

![World props](docs/art/props.gif)

## Features

- **Continuous open world:** the six regions are stamped into one map, with generated wilds between them (biomes blend at their borders), an old highway with wayside shrines, milestones, lanterns, herbs, chests and roaming beasts, rivers joining the creek, the bamboo stream and the lake, a waterfall and a lavafall off the world's edge, and two sky bridges up to the floating islands. Terrain columns are painted lazily as they come into view, and only the visible diagonals are drawn. Sky, weather, light and tint cross-fade as you walk from one region into the next, and the region banner and first-arrival scene trigger at the border.
- **A living world:** a day/night cycle (stars come out, shooting stars streak past, lanterns glow), dragonflies over the shallows, fireflies rising from the grass after dusk, dandelion seeds on the wind, lava bubbles that swell and pop, birds and bats wheeling overhead, butterflies over meadow flowers, koi leaping in the water, cloud shadows drifting over the land, footprints in sand, snow and ash, cranes that take flight when you come close, NPCs who turn and wave as you pass, a peddler walking the highway with his shop, beasts that shout "!" and gallop after you (and give up with a "?"), and beaten beasts that come back once you've been away for a while.
- **2.5D isometric world:** height-mapped tile maps with cliffs, stairs, raised platforms, floating islands with rocky undersides, animated water and lava with shore foam, depth-sorted props (sliced into screen columns so they occlude correctly), contact shadows, an x-ray silhouette when the heroine walks behind something, and parallax skies.
- **Building interiors:** five cutaway rooms behind real doors in the world, each its own small map run by the same World runtime: back walls with timber frames, wainscots and lattice windows, raised floors with rugs, daylight shafts that follow the day/night cycle, and lamplit furniture. Walking into a door goes through it; walking out over the threshold mat steps back onto the street. Saves made indoors remember the step outside, so a reload lands in the open world. You can't ride your sword or open the world map under a roof.
- **Procedural 3D pixel sprites:** 62 humanoid characters, 9 beasts and a rider on her horse, each built from roughly 20 ray-cast solids (bell skirts, sleeves, hair strands, shawls, tails, hats, weapons) with hue-shifted 4-tone shading, face decals and selective outlines. They render in 16 directions with up to 33 animations: idle, walk, run, talk, attack, cast, hurt, meditate, sword-flight, victory, defeat, bow, wave, gather (kneel and pick), drink, cheer, point and nod, stretch and look-around idle fidgets, plus hop, practice, fishing, sweeping, dancing and dozing, and the everyday ones: reading (with a page turn), sitting, kneeling in prayer, weaving at a loom, pouring tea, clapping, laughing, a seated storyteller's sweeping gestures, and four pastimes: playing the dizi flute (with a few notes over her head), eating a bowl of noodles, juggling three bright balls and cooling off with a folding fan; and the newest: the cultivator's fist-in-palm salute, a twirl on the spot that flares the skirts, a smith's hammer ringing on the anvil, kneeling to write with a brush, a restless shade drifting above the ground, and holding up a festival lantern; and the doubled world's: hoeing, chopping firewood, walking under a carrying pole, kicking a shuttlecock, strolling under an oiled-paper umbrella and slow taiji. People can change clothes: every humanoid can wear **outfits** (style overrides painted and cached per outfit, on foot, on horseback, in battle and in their portrait). Horses walk, gallop, graze and rear, and Lin Yue rides one: horse and rider are painted into one depth buffer so they occlude each other properly. Foxes and wolves gallop with a run cycle, sniff the ground and curl up asleep with their tails wrapped round them; wolves sit back and howl; cranes peck at the grass. Dialogue portraits are rendered from the same models at 3× scale, with blink and talk frames.
- **Idle life:** villagers and wayfarers break into nods, stretches, sips of tea, pours from the teapot, claps, laughs, little dances and cheers when nobody needs them; sleepers breathe with drifting "Z"s; roaming beasts stop to sniff, howl or nap (and leap up the moment they spot you); Lin Yue drinks her pills, reads the steles she stops at, bows in prayer at altars and, left alone, nods, points, claps and laughs as well as stretching, and in the end sits down where she stands until you move her again. Fish shadows glide in slow circles under the water, and washing flaps on a line in Willow Creek.
- **118 props, 77 of them animated** (buildings grow with the world, drawn 2–4× their size and painted only when first seen): swaying pines, cherry and maple trees, bamboo groves, willows, a glowing spirit tree, the multi-tier Hall of Clouds, village houses with chimney smoke, a lake pavilion, flickering lanterns and braziers that cast soft glows at night, waving banners, a bubbling alchemy cauldron, bobbing lotuses and boats, a rotating taiji dais, a pulsing blood altar, a turning waterwheel that sheds water, crackling campfires, scarecrows flapping in the wind, a five-tier pagoda with swinging wind chimes, a teahouse with a fluttering tea flag, tents, fluttering prayer flags, steaming hot-spring rocks, karst spires, temple ruins, haystacks and benches; and indoors, bookcases, hanging scrolls that stir in the draught, a brick stove with a fire and a steaming wok, a loom, a millstone with its crown wheel, grain sacks, ancestral altars with incense and candles, a bronze tree of seven oil lamps, a jade founder's statue, folding screens, a bed, an herb-drying rack, porcelain vases, a sword rack, tea tables with steaming cups, cushions and a washing line; and new: strings of festival lanterns swinging over the village square and the crossroads, bronze temple bells that swing now and then in their bell-frames, and a paper kite riding the wind over Willow Creek; and newest: a village forge with breathing bellows and a red-hot blade on the anvil, the Sword Tomb bristling with glinting blades, peach trees in blossom and fruit that shed petals, straw beehives with bees looping round them, a lonely grave with a stick of incense, drifting will-o'-wisps, and festival fireworks that climb and burst over Willow Creek once the Heart is home (props can now appear only while a story condition holds); and for the doubled world: junks at anchor, a lighthouse with a turning beam, circling koi, butterflies, tea bushes, fan palms, snow pines, a fountain, a war drum, fish-drying racks, stupas, a noodle cart, a bronze censer, stilt houses, archery targets, handcarts and wine jars. Little dust devils (and whirls of ash and sand) spin along the roads. With the year: a bronze sundial whose shadow follows the hour, snowmen, leaf piles, persimmons drying on a rack and beds of rice seedlings.
- **Eleven regions plus a world map:** the five new ones of the doubled world (the Mistmarsh, the Cloudmist Tea Terraces, the Yellow Sands, Wavecrest Harbour and Frostveil Monastery), and the floating Azure Cloud Sect (day, falling petals), Willow Creek Village (dusk, autumn leaves), the Whispering Bamboo Forest (fireflies), the Moonlit Lotus Lake (night, stars and moon), the Crimson Demon Valley (blood moon, embers, lava) and Heavenly Tribulation Peak (snow, storm lightning). The miniature isometric continent has roads, rivers, sea, drifting clouds and their shadows, and animated landmarks. Regions unlock as the story advances.
- **A calendar and four seasons:** day, night and the seasons follow the save; seasonal sprites and ground, weather, NPC clothes and habits, a sun and moon, golden hours and summer showers (see [The turning year](#the-turning-year-a-thousand-notices-and-a-wardrobe)).
- **1000 notices and a second main quest:** a thousand composed side quests from 86 folk, and the Turning of the Year, waking four seasonal Wardens.
- **Choices that matter:** questions put to the heroine (a choice panel with hints), remembered as story flags; three sect quest lines and a five-way conclave over the Dragon Vein, standing with each sect (Hostile to Allied), and 26 terrain patches that change the world and the caves as the story goes (plus skies that change with it) (see [Three sects, the deep, and choices that matter](#three-sects-the-deep-and-choices-that-matter)).
- **Underground:** three caves (Ember Mine, Sunken Grotto, Dragon Vein Caverns) carved as cutaways of living rock at many heights, with a cave sky of dripping stalactites, drips and glowing spores, a torch she holds up, and battles on a ledge in the dark.
- **Narrative:** three beginnings, a prologue, six chapters, an epilogue and five endings (see [Three beginnings](#three-beginnings-a-heart-to-choose-and-five-endings)), with a quest tracker, scripted cutscenes (walk, emote, camera, flash, shake, spawn), typed-out dialogue with animated portraits, full-screen narration, first-arrival scenes, pre-boss speeches and an ending; plus four side errands shown under the quest tracker (a ghost's unfinished letter, two quarrelling brothers, a sword brought home, a dead husband's cloak) and Willow Creek's lantern festival, each ending in a new outfit.
- **Cultivation:** 6 realms × 4 stages. Battles, spirit herbs, chests and shrine meditation grow your cultivation. At a realm's peak you must survive a Heavenly Tribulation (3 bolts, or 9 for the final ascension).
- **Turn-based battles** on themed isometric arenas, with five techniques (Azure Sword Strike, Jade Lotus Palm, Lotus Heart Sutra, Myriad Swords Return, Nine Heavens Thunder), pills and fleeing. Fighters dash in, recoil, throw qi orbs and foxfire, and call down lightning, with damage pop-ups, crits, screen shake and flashes.
- **Controls:** keyboard, click/tap-to-walk, and a virtual joystick on touch screens.
- **Full stack:** saves are validated with zod and stored server-side by Route Handlers in an atomic JSON file store. A leaderboard of top cultivators is computed from all saves. The gallery at `/gallery` plays every character, prop and region live.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` · `npm run typecheck` | ESLint (next core-web-vitals + TS) · `tsc --noEmit` |
| `npm test` | Vitest unit tests (ray caster, art, areas, story, engine, runtime, API) |
| `npm run test:e2e` | Playwright end-to-end tests (needs `npm run build` first; set `PW_CHROMIUM` to use a local Chromium) |
| `npm run screenshots` | Re-captures `docs/screenshots/*` through Playwright |
| `npm run assets` | Exports the animated GIF showcases and PNGs to `docs/art/` (add `-- docs/art --overview` for the picture of the whole world) |

Saves live in `$DATA_DIR/saves.json` (default `.data/`). Set `SAVE_STORE=memory` for an ephemeral in-memory store. Saves are version 5; the world doubled again around the old lands without moving them, so every version 5 position is still the same spot. Older saves are migrated on load: version 4 positions from the 324 × 232 world are doubled into the magnified world, version 3 positions from the smaller 162 × 116 world keep their place relative to their region, and a position that is no longer open ground (or a save made while flying over water) lands on the nearest open tile.

## Controls

| Key | Action |
|---|---|
| `W A S D` / arrows (or click / tap a tile) | Walk (screen-relative) |
| `Shift` (or push the joystick all the way) | Run |
| `F` | Ride the flying sword (crosses water, enemies can't reach you) |
| `R` | Whistle for Cloudmane, your spirit horse (`Shift` to gallop; `R` again to dismount) |
| `C` | Change into the next outfit you own |
| `V` | Wardrobe: every outfit, owned or not; click one to put it on |
| `J` | Journal: every quest and rumour, the Turning of the Year, the notices you carry (set one aside), and how each sect regards you |
| `1`–`5` / `↑` `↓` + `E` | Answer a question put to Lin Yue (or click an answer) |
| `E` / `Space` / `Enter` | Talk · meditate at shrines · open chests · gather herbs · read steles · enter and leave buildings · open the world map at a region's gate |
| `M` | World map of the real world (arrows or clicks pick a region, the sword flies there, `E` lands at its waypoint) |
| `B` | Face the Heavenly Tribulation (while meditating at a bottleneck) |
| `H` / `Q` | Swallow a healing / qi pill |
| `1`–`5` | Battle techniques · `6` `7` pills · `0` flee |
| `Esc` | Skip a cutscene |

## Story

```mermaid
flowchart TD
  O{{"Three beginnings:<br/>disciple · foundling · runaway"}} --> P
  P["Prologue · The Stolen Heart<br/>Elder Mo sends Lin Yue after the Blood Moon Sect"] --> C1
  C1["Chapter I · Trouble Below the Clouds<br/>Drive off the fox haunting Willow Creek, hear Head Zhou's tale"] --> C2
  C2["Chapter II · Whispers in the Bamboo<br/>Calm 3 maddened fox spirits, meet Hu Li the fox maiden"] --> C3
  C3["Chapter III · The Moonlit Lake<br/>Find Old Fisher Wen, subdue the Serpent King,<br/>learn Myriad Swords Return"] --> C4
  C4["Chapter IV · Heaven's Gate<br/>Survive the tribulation into Foundation Establishment"] --> C5
  C5["Chapter V · The Blood Moon<br/>Defeat (or talk home) Patriarch Xue, choose the Jade Lotus Heart's fate"] --> C6
  C5 -- "the Heart drunk" --> C6b["Chapter VI · The Crimson Throne<br/>Face Elder Mo in the Hall of Clouds"] --> E
  C6["Roots of Heaven / The Blood Moon<br/>Tell Elder Mo what became of the Heart"] --> E
  E["Epilogue · Ascension<br/>Climb Tribulation Peak, endure nine bolts,<br/>and choose at heaven's stair: five endings"]
  classDef c fill:#241a40,stroke:#3fb59a,color:#fff6dc;
  class P,C1,C2,C3,C4,C5,C6,C6b,E c;
```

### The world and its seals

Every tile belongs to the nearest region; the five new regions also hold the wider country around them (the steppe and the coast answer to Wavecrest Harbour, the snowfields to Frostveil, the sand seas and badlands to the Yellow Sands). The Mistmarsh and the tea terraces open once Elder Mo has sent her down the mountain, the Yellow Sands and the harbour once Willow Creek is safe, and Frostveil's cold turns her back until Foundation Establishment. A sealed region's border shows a wall of mist that the heroine can't cross, even on her sword, until the story lifts it.

```mermaid
flowchart TB
  subgraph sky["Above the sea of clouds"]
    peak["天劫峰 Tribulation Peak"]
    sect["青云宗 Azure Cloud Sect"]
    isles["云阶岛 Cloudstep Isles"]
    rest["云憩岛 Cloudrest Isle"]
  end
  subgraph mainland["The mainland"]
    valley["血魔谷 Demon Valley"]
    bamboo["竹林 Bamboo Forest"]
    village["柳溪村 Willow Creek"]
    mill["水磨坊 Watermill"]
    lake["月莲湖 Lotus Lake"]
    hw(["the old highway"])
    tomb["剑冢 Sword Tomb<br/>(westwood)"]
    pav["望月亭 Moon-Gazing Pavilion"]
    orch["桃园 Peach Orchard"]
  end
  subgraph south["The southern lands"]
    camp["血月营 Blood Moon Camp<br/>(ashen wastes)"]
    temple["静水寺 Temple of Still Water<br/>(stone forest)"]
    tea["茶馆 Crossroads Teahouse"]
    pagoda["七灯塔 Pagoda of Seven Lamps<br/>(scarecrow fields)"]
    spring["温泉 Hot Spring"]
    bandits["山寨 Bandit Camp<br/>(highlands)"]
  end
  sect -- "sky bridge behind the Hall of Clouds · seal: Heart returned" --> peak
  sect -- "plank walkways" --> isles
  sect -- "sky bridge below the gate" --> rest
  rest -- "seal: met Elder Mo" --> village
  village -- "creek road" --> mill
  hw -- "north road" --> tomb
  village -- "west footpath" --> pav
  hw -- "east of the lake" --> orch
  hw --> tea
  tea --> temple
  hw --> pagoda
  hw --> spring --> bandits
  hw --> camp
  village -- "south road" --> hw
  hw -- "talisman seal: Head Zhou's request" --> bamboo
  hw -- "spirit mist: Hu Li's charm + Qi Late" --> lake
  hw -- "demonic qi: Serpent King + Foundation" --> valley
  village -. "creek" .-> bamboo
  village -. "creek" .-> lake
  lake -. "waterfall off the world's edge" .-> clouds((clouds))
  temple -. "the bamboo stream falls off the southern cliffs" .-> clouds
  camp -. "lavafall" .-> clouds
```

### The folk of the wilds

Every keeper has a first meeting with a gift, then rotating small talk. Their beasts and bandits respawn like the rest of the jianghu's.

```mermaid
flowchart LR
  fang["Auntie Fang · teahouse"] -- "first cup free: full HP/QI" --> shop[("pills for sale")]
  tang["Miller Tang · watermill"] -- "2 Qi Gathering Pills" --> you((Lin Yue))
  kong["Monk Kong · ruined temple"] -- "Still Water Sutra: +50% of a stage" --> you
  yun["Master Yun · Cloudstep Isles"] -- "cloud teaching: +60% of a stage" --> you
  wu["Farmer Wu · scarecrow fields"] -- "20 spirit stones" --> you
  han["Xiao Han · hot spring"] -- "friendly duel (a loss never sends you home)" --> duel{won?}
  duel -- yes --> stones["80 spirit stones"]
  duel -- no --> han
  bandits["3 bandit leaders"] -- "routed: 40 spirit stones" --> you
```

### Doors, rooms and the lore inside

Each building's door is an interactable on the open-world tile in front of it, and each room is a tiny `AreaDef` of its own. Behind the doors the jianghu's history comes out: who the founder was, why the sect floats, what the Heart really is, the war of the Blood Moon two hundred years ago, and the boy from Willow Creek who became Patriarch Xue.

```mermaid
flowchart LR
  subgraph world["The open world"]
    hd(["Hall of Clouds door<br/>(sect plaza)"])
    cd(["Cottage door<br/>(Willow Creek)"])
    td(["Teahouse door<br/>(crossroads)"])
    md(["Mill door<br/>(east creek)"])
    pd(["Pagoda door<br/>(scarecrow fields)"])
  end
  hd --> hall["云殿 Hall of Clouds<br/>Archivist Shen · ancestral altar · annals,<br/>war record, disciple register, bridge ledger"]
  cd --> cot["华婆小屋 Granny Hua's cottage<br/>Weaver Lü at the loom · her husband's sword ·<br/>jars 'for when he comes home'"]
  td --> tea["茶馆 Crossroads Teahouse<br/>Storyteller Qiao's tales · Scholar Gu ·<br/>the carved post"]
  md --> mill["水磨坊 Watermill<br/>Little Dou sweeping · the millstone's<br/>forty tally marks"]
  pd --> pag["七灯塔 Pagoda of Seven Lamps<br/>Sister Ming · seven names ·<br/>the painting of the seven farmers"]
  hall -- "threshold mat / E" --> step(("the step<br/>outside"))
  cot --> step
  tea --> step
  mill --> step
  pag --> step
  classDef r fill:#241a40,stroke:#3fb59a,color:#fff6dc;
  class hall,cot,tea,mill,pag r;
```

```mermaid
flowchart LR
  shen["Archivist Shen"] -- "the founder's breathing method: +40% of a stage" --> you((Lin Yue))
  qiao["Storyteller Qiao"] -- "the founder's tale: +25% of a stage,<br/>then rotating legends" --> you
  lu["Weaver Lü"] -- "2 Healing Pills" --> you
  ming["Sister Ming"] -- "the seven lamps' blessing:<br/>full HP/QI, +30% of a stage" --> you
  gu["Scholar Gu"] -. "small talk" .-> you
  dou["Little Dou"] -. "small talk" .-> you
```

### How the world is built

```mermaid
flowchart LR
  A["Eleven hand-built region layouts<br/>world/areas.ts"] --> S["Stamp at REGION_ORIGIN<br/>world/layout.ts"]
  N["Wilds: noise biomes blended by nearest<br/>region or southern zone (wastes, stone forest,<br/>fields, highlands)"] --> S
  S --> I["Floating isles &<br/>levelled landmark sites"]
  I --> C["Carve rivers, hot spring, lava pools,<br/>highway, branches, sky bridges & walkways"]
  C --> L["Smooth wild heights<br/>(≤ 1 level per tile from roads,<br/>regions and rivers)"]
  L --> P["Furnish landmarks (keepers, beasts,<br/>treasure), scatter trees,<br/>drop props off roads/water,<br/>block footprints"]
  P --> X["Magnify 2×: Scale2x the terrain,<br/>move placements to their blocks,<br/>grow buildings (rooms 1:1), thicken the wild<br/>world/magnify.ts"]
  X --> R["Region of every tile → seals,<br/>sky / weather / light blend"]
  R --> W["WorldDef (one TileMap)<br/>world/continent.ts"]
  W --> RT["World runtime: lazy tile painting,<br/>visible-diagonal renderer"]
  W --> M["World map: 9×9 downsample<br/>+ landmark icons<br/>world/overworld.ts"]
```

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI["React UI (fullscreen overlay)<br/>HUD · quest · dialogue + portraits ·<br/>world map · battle · shop · touch joystick"]
    RT["Game runtime<br/>runtime/Game.ts"]
    CS["CanvasSurface<br/>viewport-sized canvas,<br/>integer pixel scale"]
    UI -- "input & actions" --> RT
    RT -- "UiSnapshot" --> UI
    RT -- "render(surface)" --> CS
  end

  subgraph Pure["Pure TypeScript (browser, Node & tests)"]
    SC["Scenes<br/>World (iso area) · WorldMap · BattleScene"]
    ST["Story<br/>quests · dialogue · cutscene scripts"]
    ENG["Engine<br/>realms · battle · enemies · state (zod)"]
    ART["Pixel art<br/>ray caster · characters · props ·<br/>tiles · skies"]
    WD["World data<br/>areas · interiors · tile maps · overworld"]
  end

  subgraph Server["Next.js Route Handlers"]
    SAVE["/api/save/[playerId]<br/>GET · PUT · DELETE"]
    LB["/api/leaderboard"]
    HL["/api/health"]
    STORE[("FileSaveStore<br/>.data/saves.json")]
    SAVE --> STORE
    LB --> STORE
  end

  RT --> SC
  RT --> ST
  SC --> ENG
  SC --> ART
  SC --> WD
  UI -- "fetch (JSON)" --> SAVE
  UI -- fetch --> LB
  EXP["scripts/export-assets.ts"] --> ART
  EXP --> GIF["docs/art/*.gif · *.png"]
```

### Game modes

```mermaid
stateDiagram-v2
  [*] --> Title
  Title --> Scene: Begin Cultivation (opening narration)
  Title --> Explore: Continue
  Scene --> Explore: script ends / Esc skips
  Explore --> Scene: talk to NPC · read stele · first arrival
  Scene --> Shop: Senior Sister Qing
  Shop --> Scene
  Explore --> Explore: walk across a border (banner, sky blend)
  Explore --> Scene: first arrival in a region
  Explore --> WorldMap: M / E at a waystone
  WorldMap --> Explore: land at a waypoint (E)
  Explore --> Scene: touch a boss (speech)
  Scene --> Battle
  Explore --> Battle: touch a demonic beast
  Battle --> Scene: victory (story consequences)
  Battle --> Explore: flee / defeat (wake at sect shrine, same world)
  Explore --> Indoors: walk into a door / E on its step (still explore mode, in a room)
  Indoors --> Explore: threshold mat (back on the step)
  Indoors --> Scene: talk · read a shelf · pray at an altar
  Scene --> Choice: a question is put to her
  Choice --> Scene: 1–5 / ↑↓ E / click (the answer's steps run, flags and standing change)
  Scene --> Scene: { reshape } lays the story's terrain patches down (tremor, dust)
  Explore --> Cave: walk into a cave mouth (torch up, battles on a ledge in the dark)
  Cave --> Explore: back out through the mouth
  Explore --> Journal: J (quests, rumours, sect standing)
  Journal --> Explore: J / Esc / E
  Explore --> Explore: R mounts / dismounts Cloudmane (canter, Shift gallops)
  Explore --> Meditate: E at a shrine
  Meditate --> Tribulation: B at a bottleneck
  Tribulation --> Explore: breakthrough
  Tribulation --> Scene: final ascension (ending)
```

### How a sprite is made

```mermaid
flowchart TB
  P["Pose (per frame)<br/>feet · hands · lean · bob · wind ·<br/>eyes · mouth · sword"] --> R
  S["Style<br/>palettes · hair · hat · beard ·<br/>cape · tails · weapon · scale"] --> R
  R["Rig: ~20 solids in model space<br/>spheres · ellipsoids · sphere-swept splines ·<br/>convex boxes / prisms / cones"] --> F
  F["Facing basis (16 directions)<br/>model → camera (h, d, z)"] --> X
  X["Per-pixel ray cast through a 30° iso camera<br/>z-buffer · Lambert light → 4-tone hue-shifted ramp ·<br/>per-material shaders (hems, collars, scales, roof tiles)"] --> D
  D["Decals: eyes · mouth · blush<br/>(visible only when facing the camera)"] --> O
  O["Selective outline<br/>inner lines where parts overlap + silhouette"] --> B["PixelBuffer frame (cached lazily)"]
  B --> B1["Browser: cached canvas → drawImage"]
  B --> B2["Node: GIF / PNG export"]
  B --> B3["Vitest: determinism & coverage"]
```

### Isometric renderer

```mermaid
flowchart LR
  T["Tile columns<br/>(textured top + cliff walls,<br/>painted once per area)"] --> K
  PR["Props<br/>sliced into 16 px screen columns,<br/>each bucketed by its footprint"] --> K
  A["Actors<br/>bucket = ⌊x⌋+⌊y⌋"] --> K
  K["Draw diagonals back → front<br/>tiles, then props & actors sorted by depth"] --> L
  L["Liquids · emitters (smoke, embers, petals) ·<br/>particles · weather"] --> N
  N["Lighting: night tint + glow sprites<br/>for lanterns, braziers, shrines, the heroine"] --> O2["Emotes · quest markers"]
```

### One battle round

`resolveTurn` is a pure function: it takes the game state, the battle state and an action, and returns the new states plus a list of events. The RNG seed lives in the battle state, so a round always replays the same way. `BattleScene` turns those events into a timeline of dashes, projectiles, lightning and pop-ups on an isometric arena themed after the current region.

```mermaid
sequenceDiagram
  participant P as Player (UI)
  participant G as Game runtime
  participant E as Engine.resolveTurn
  participant B as BattleScene timeline
  P->>G: battleAction({skill: "thunder"})
  G->>E: (state, battle, action)
  E-->>G: {game', battle', events[]}
  G->>B: playEvents(events)
  B->>B: heroine "cast" pose
  loop 2 bolts
    B->>B: lightning strike → hit flash, damage pop-up, shake
  end
  B->>B: enemy dashes in / fires its special → heroine "hurt"
  B-->>G: busy = false (or victory → story script)
  G-->>P: UiSnapshot (HP/QI bars, log)
```

## Testing & CI

```mermaid
flowchart LR
  PR["push / pull_request"] --> Q["quality job<br/>npm ci → lint → typecheck →<br/>vitest → art export smoke test"]
  PR --> E2["e2e job<br/>npm ci → next build →<br/>playwright install → playwright test"]
  E2 -- on failure --> R["upload playwright-report"]
```

- **Unit tests (Vitest):** the iso projection and ray caster (shading, depth, decal visibility, convex solids), every character × animation × direction, all portraits and props, terrain and skies. Every region layout, and then the whole continuous world, is checked by BFS: every waypoint, NPC, encounter and interactable is reachable on foot, the sky bridges connect, rivers reach the edge, and no prop stands in water or on the road. Also covered: the world map's terrain (built from the real world), save migration from per-region coordinates and from the smaller world, the grown world's size, landmarks and new folk, a complete story walkthrough from prologue to ascension, realms and battle rules, a headless run of the `Game` runtime (cutscenes, walking and collision, tap-to-walk, the elder's briefing, world-map travel, battles won and lost, boss speeches, the fox quest, meditation and tribulation, pickups, rendering every region, walking down the sky bridge into the village, seals turning the heroine back, running, startled cranes, greeting NPCs, respawning beasts, idle fidgets and the day cycle, the wayside folk's gifts, Xiao Han's duel won and lost, landmark banners, beasts sniffing, howling and dozing, opening the map while flying over water, loading a save onto open ground, walking into the Hall of Clouds through its door and back out over the threshold, learning from the archivist, reading the shelves and praying at the altar, every room rendering with its folk at work, losing a fight indoors, a beast standing its ground at the edge of its territory, a lost friendly duel costing nothing, and scripted walks staying at a walk), every room's walls, windows and reachability, every building's door on open ground in front of it, the indoor folk's one-time gifts, and the API route handlers.
- **The year and the notices (Vitest):** the calendar (seasons, phases, passing time, a save keeps its hour), seasonal filters on props, every season by day and night with the folk in winter wool and lanterns after dark, the season banner, the whole Turning of the Year from the almanac to the four Wardens and the Raiment, the wardrobe, and the thousand notices (exactly 1000, deterministic, every giver, landmark, beast and shrine really in the world, three slots, bits in the save, milestones, a delivery taken and handed over, a night visit and a hunt fulfilled in the running game).
- **E2E (Playwright):** the wardrobe, the calendar turning at the sundial and a notice taken and set aside from the journal; and  fullscreen title and health check, opening narration and walking, walking from the sect into the village in one world, Elder Mo's briefing through to world-map travel, a battle won through the UI, tea and the shop at the crossroads teahouse (with Enter skipping the typewriter text), stepping inside the crossroads teahouse to hear the storyteller and walking back out, a save/reload/continue round trip with the leaderboard, and the gallery canvases painting (now with the indoor folk and every room).

## Project layout

```
src/
  app/                 Next.js App Router: pages (/, /gallery) + API route handlers
  components/          React UI (GameApp, GameView, SpriteGallery, canvas loop hook)
  game/
    pixel/             PixelBuffer, colour, noise, RNG, 3×5 font, Surface abstraction
    iso/               isometric projection + z-buffered pixel-art ray caster
    art/               palettes, humanoid & beast rigs, character registry & portraits,
                       props, terrain tiles, skies
    world/             tile maps, the six region layouts, the world layout,
                       the continuous world builder (continent.ts), the building
                       interiors (interiors.ts), the world map
    story/             cutscene step types, quests, dialogue, scripted scenes
    engine/            realms, enemies, battle, zod save schema (pure)
    runtime/           Game loop, World (open world + battle arenas), WorldMap, BattleScene, particles, title
  server/              save store (atomic JSON file / memory)
tests/                 Vitest unit tests
e2e/                   Playwright specs (+ screenshot capture)
scripts/               GIF/PNG art export
docs/                  screenshots & exported art
```
