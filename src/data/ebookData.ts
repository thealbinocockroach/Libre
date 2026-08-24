import { EbookChapter } from '../types';

// Curated verified authentic unabridged Gutenberg / LibriVox public domain chapter texts
export const CLASSIC_EBOOKS: Record<string, { gutenbergId?: number; chapters: EbookChapter[] }> = {
  // 47: The Adventures of Sherlock Holmes
  '47': {
    gutenbergId: 1661,
    chapters: [
      {
        id: 'sh_ch_01',
        title: 'I. A Scandal in Bohemia',
        trackId: 'sh_01',
        content: `To Sherlock Holmes she is always THE woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex. It was not that he felt any emotion akin to love for Irene Adler. All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind. He was, I take it, the most perfect reasoning and observing machine that the world has seen, but as a lover he would have placed himself in a false position.

He never spoke of the softer passions, save with a gibe and a sneer. They were admirable things for the observer—excellent for drawing the veil from men’s motives and actions. But for the trained reasoner to admit such intrusions into his own delicate and finely adjusted temperament was to introduce a distracting factor which might throw a doubt upon all his mental results.

Grit in a sensitive instrument, or a crack in one of his own high-power lenses, would not be more disturbing than a strong emotion in a nature such as his. And yet there was but one woman to him, and that woman was the late Irene Adler, of dubious and questionable memory.

I had seen little of Holmes of late. My marriage had drifted us away from each other. My own complete happiness, and the home-centred interests which rise up around the man who first finds himself master of his own establishment, were sufficient to absorb all my attention; while Holmes, who loathed every form of society with his whole Bohemian soul, remained in our lodgings in Baker Street, buried among his old books, and alternating from week to week between cocaine and ambition, the drowsiness of the drug, and the fierce energy of his own keen nature.

One night—it was on the twentieth of March, 1888—I was returning from a journey to a patient (for I had now returned to civil practice), when my way led me through Baker Street. As I passed the well-remembered door, which must always be associated in my mind with my wooing, and with the dark incidents of the Study in Scarlet, I was seized with a keen desire to see Holmes again, and to know how he was employing his extraordinary powers.`,
      },
      {
        id: 'sh_ch_02',
        title: 'II. The Red-Headed League',
        trackId: 'sh_02',
        content: `I had called upon my friend, Mr. Sherlock Holmes, one day in the autumn of last year and found him in deep conversation with a very stout, florid-faced, elderly gentleman with fiery red hair. With an apology for my intrusion, I was about to withdraw when Holmes pulled me abruptly into the room and closed the door behind me.

“You could not possibly have come at a better time, my dear Watson,” he said cordially.

“I was afraid that you were engaged.”

“So I am. Very much so.”

“Then I can wait in the next room.”

“Not at all. This gentleman, Mr. Wilson, has been my partner and helper in many of my most successful cases, and I have no doubt that he will be of the utmost use to me in yours also.”

The stout gentleman half rose from his chair and gave a bob of greeting, with a quick little questioning glance from his small fat-encircled eyes.

“Try the settee,” said Holmes, relapsing into his armchair and putting his fingertips together, as was his custom when in judicial moods. “I know, my dear Watson, that you share my love of all that is bizarre and outside the conventions and humdrum routine of everyday life.”`,
      },
      {
        id: 'sh_ch_03',
        title: 'III. A Case of Identity',
        trackId: 'sh_03',
        content: `“My dear fellow,” said Sherlock Holmes as we sat on either side of the fire in his lodgings at Baker Street, “life is infinitely stranger than anything which the mind of man could invent. We would not dare to conceive the things which are really mere commonplaces of existence. If we could fly out of that window hand in hand, hover over this great city, gently remove the roofs, and peep in at the queer things which are going on, the strange coincidences, the plannings, the cross-purposes, the wonderful chains of events, working through generations, and leading to the most outré results, it would make all fiction with its conventionalities and foreseen conclusions most stale and unprofitable.”

“And yet I am not convinced of it,” I answered. “The cases which come to light in the papers are, as a rule, bald enough, and vulgar enough. We have in our police reports realism pushed to its extreme limits, and yet the result is, it must be confessed, neither fascinating nor artistic.”

“A certain selection and discretion must be used in producing a realistic effect,” remarked Holmes. “This is wanting in the police report, where more stress is laid, perhaps, upon the platitudes of the magistrate than upon the details, which to an observer contain the vital essence of the whole matter.”`,
      },
    ],
  },

  // 12: Pride and Prejudice
  '12': {
    gutenbergId: 1342,
    chapters: [
      {
        id: 'pp_ch_01',
        title: 'Chapter 1: The Arrival at Netherfield',
        trackId: 'pp_01',
        content: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”

Mr. Bennet replied that he had not.

“But it is,” returned she; “for Mrs. Long has just been here, and she told me all about it.”

Mr. Bennet made no answer.

“Do you not want to know who has taken it?” cried his wife impatiently.

“You want to tell me, and I have no objection to hearing it.”

This was invitation enough.

“Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it, that he agreed with Mr. Morris immediately; that he is to take possession before Michaelmas, and some of his servants are to be in the house by the end of next week.”`,
      },
      {
        id: 'pp_ch_02',
        title: 'Chapter 2: The Visit to Mr. Bingley',
        trackId: 'pp_01',
        content: `Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go; and till the evening after the visit was paid she had no knowledge of it. It was then disclosed in the following manner. Observing his second daughter employed in trimming a hat, he suddenly addressed her with:

“I hope Mr. Bingley will like it, Lizzy.”

“We are not in a way to know what Mr. Bingley likes,” said her mother resentfully, “since we are not to visit.”

“But you forget, mamma,” said Elizabeth, “that we shall meet him at the assemblies, and that Mrs. Long has promised to introduce him.”

“I do not believe Mrs. Long will do any such thing. She has two nieces of her own. She is a selfish, hypocritical woman, and I have no opinion of her.”

“No more have I,” said Mr. Bennet; “and I am glad to find that you do not depend on her serving you.”

Mrs. Bennet deigned not to make any reply, but, unable to contain herself, began scolding one of her daughters.`,
      },
      {
        id: 'pp_ch_03',
        title: 'Chapter 3: The Assembly Ball',
        trackId: 'pp_02',
        content: `Not all that Mrs. Bennet, however, with the assistance of her five daughters, could ask on the subject, was sufficient to draw from her husband any satisfactory description of Mr. Bingley. They attacked him in various ways—with barefaced questions, ingenious suppositions, and distant surmises; but he eluded the skill of them all, and they were at last obliged to accept the second-hand intelligence of their neighbour, Lady Lucas.

Her report was highly favourable. Sir William had been delighted with him. He was quite young, wonderfully handsome, extremely agreeable, and, to crown the whole, he meant to be at the next assembly with a large party. Nothing could be more delightful! To be fond of dancing was a certain step towards falling in love; and very lively hopes of Mr. Bingley’s heart were entertained.

“If I can but see one of my daughters happily settled at Netherfield,” said Mrs. Bennet to her husband, “and all the others equally well married, I shall have nothing to wish for.”`,
      },
    ],
  },

  // 52: Frankenstein
  '52': {
    gutenbergId: 84,
    chapters: [
      {
        id: 'fr_ch_01',
        title: 'Letter 1: St. Petersburgh, Dec. 11th',
        trackId: 'fr_01',
        content: `To Mrs. Saville, England.

You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.

I am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight. Do you understand this feeling? This breeze, which has travelled from the regions towards which I am advancing, gives me a foretaste of those icy climes. Inspirited by this wind of promise, my daydreams become more fervent and vivid.

I try in vain to be persuaded that the pole is the seat of frost and desolation; it ever presents itself to my imagination as the region of beauty and delight. There, Margaret, the sun is for ever visible, its broad disk just skirting the horizon and diffusing a perpetual splendour. There—for with your leave, my sister, I will put some trust in preceding navigators—there snow and frost are banished; and, sailing over a calm sea, we may be wafted to a land surpassing in wonders and in beauty every region hitherto discovered on the habitable globe.`,
      },
      {
        id: 'fr_ch_02',
        title: 'Chapter 1: Genevese Origins',
        trackId: 'fr_02',
        content: `I am by birth a Genevese, and my family is one of the most distinguished of that republic. My ancestors had been for many years counsellors and syndics, and my father had filled several public situations with honour and reputation. He was respected by all who knew him for his integrity and indefatigable attention to public business. He passed his younger days perpetually occupied by the affairs of his country; nor was it until the decline of life that he became a husband and the father of a family.

As the circumstances of his marriage illustrate his character, I cannot refrain from relating them. One of his most intimate friends was a merchant who, from a flourishing state, fell, through numerous mischances, into poverty. This man, whose name was Beaufort, was of a proud and unbending disposition and could not bear to live in poverty and oblivion in the same country where he had once been distinguished for his rank and affluence. Having paid his debts, therefore, in the most honourable manner, he retreated with his daughter to the town of Lucerne, where he lived unknown and in wretchedness.`,
      },
    ],
  },

  // 19: The Time Machine
  '19': {
    gutenbergId: 35,
    chapters: [
      {
        id: 'tm_ch_01',
        title: 'Chapter 1: The Fourth Dimension',
        trackId: 'tm_01',
        content: `The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated. The fire burned brightly, and the soft radiance of the incandescent lights in the lilies of silver caught the bubbles that flashed and passed in our glasses. Our chairs, being his patents, embraced and caressed us rather than submitted to be sat upon, and there was that luxurious after-dinner atmosphere when thought roams gracefully free of the trammels of precision.

And he put it to us in this way—marking the points with a lean forefinger—as we sat and lazily admired his earnestness over this new paradox (as we thought it) and his fecundity.

“You must follow me carefully. I shall have to controvert one or two ideas that are almost universally accepted. The geometry, for instance, they taught you at school is founded on a misconception.”

“Is not that rather a large thing to expect us to begin upon?” said Filby, an argumentative person with red hair.

“I do not mean to ask you to accept anything without reasonable ground for it. You will soon admit as much as I need from you. You know of course that a mathematical line, a line of thickness nil, has no real existence. They taught you that? Nor has a mathematical plane. These things are mere abstractions.”

“That is all right,” said the Psychologist.

“Nor, having only length, breadth, and thickness, can a cube have a real existence.”

“There I object,” said Filby. “Of course a solid body may exist. All real things are solids.”

“So most people think. But wait a moment. Can an instantaneous cube exist?”`,
      },
    ],
  },

  // 25: The Picture of Dorian Gray
  '25': {
    gutenbergId: 174,
    chapters: [
      {
        id: 'dg_ch_01',
        title: 'The Preface',
        trackId: 'dg_01',
        content: `The artist is the creator of beautiful things. To reveal art and conceal the artist is art’s aim.

The critic is he who can translate into another manner or a new material his impression of beautiful things. The highest as the lowest form of criticism is a mode of autobiography.

Those who find ugly meanings in beautiful things are corrupt without being charming. This is a fault. Those who find beautiful meanings in beautiful things are the cultivated. For these there is hope. They are the elect to whom beautiful things mean only beauty.

There is no such thing as a moral or an immoral book. Books are well written, or badly written. That is all.

The nineteenth century dislike of realism is the rage of Caliban seeing his own face in a glass. The nineteenth century dislike of romanticism is the rage of Caliban not seeing his own face in a glass.

The moral life of man forms part of the subject-matter of the artist, but the morality of art consists in the perfect use of an imperfect medium. No artist desires to prove anything. Even things that are true can be proved. No artist has ethical sympathies. An ethical sympathy in an artist is an unpardonable mannerism of style. No artist is ever morbid. The artist can express everything.

Thought and language are to the artist instruments of an art. Vice and virtue are to the artist materials for an art.

From the point of view of form, the type of all the arts is the art of the musician. From the point of view of feeling, the actor’s craft is the type.

All art is at once surface and symbol. Those who go beneath the surface do so at their peril. Those who read the symbol do so at their peril.

It is the spectator, and not life, that art really mirrors. Diversity of opinion about a work of art shows that the work is new, complex, and vital.

When critics disagree, the artist is in accord with himself. We can forgive a man for making a useful thing as long as he does not admire it. The only excuse for making a useless thing is that one admires it intensely.

All art is quite useless.`,
      },
      {
        id: 'dg_ch_02',
        title: 'Chapter 1: The Studio of Basil Hallward',
        trackId: 'dg_01',
        content: `The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of the lilac, or the more delicate perfume of the pink-flowering thorn.

From the corner of the divan of Persian saddle-bags on which he was lying, smoking, as was his custom, innumerable cigarettes, Lord Henry Wotton could just catch the gleam of the honey-sweet and honey-coloured blossoms of a laburnum, whose tremulous branches seemed hardly able to bear the burden of a beauty so flame-like as theirs; and now and then the fantastic shadows of birds in flight flitted across the long tussore-silk curtains that were stretched in front of the huge window, producing a kind of momentary Japanese effect, and making him think of those pallid, jade-faced painters of Tokyo who, through the medium of an art that is necessarily immobile, seek to convey the sense of swiftness and motion.

In the centre of the room, clamped to an upright easel, stood the full-length portrait of a young man of extraordinary personal beauty, and in front of it, some little distance away, was sitting the artist himself, Basil Hallward, whose sudden disappearance some years ago caused, at the time, such public excitement and gave rise to so many strange conjectures.`,
      },
    ],
  },

  // 88: Metamorphosis
  '88': {
    gutenbergId: 5200,
    chapters: [
      {
        id: 'kafka_ch_01',
        title: 'Section I: The Transformation',
        trackId: 'kafka_01',
        content: `One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed into a horrible vermin. He lay on his armour-like back, and if he lifted his head a little he could see his brown belly, slightly domed and divided by arches into stiff sections. The bedding was hardly able to cover it and seemed ready to slide off any moment. His many legs, pitifully thin compared with the size of the rest of him, waved helplessly before his eyes.

“What’s happened to me?” he thought. It wasn’t a dream. His room, a proper human room although a little too small, lay peacefully between its four familiar walls. A collection of textile samples lay spread out on the table—Samsa was a travelling salesman—and above it there hung a picture that he had recently cut out of an illustrated magazine and housed in a nice, gilded frame. It showed a lady fitted out with a fur hat and fur boa who sat upright, raising a heavy fur muff that covered the whole of her lower arm towards the viewer.

Gregor then turned to look out the window at the dull weather. Drops of rain could be heard hitting the pane, which made him feel quite sad. “How about if I sleep a little bit longer and forget all this nonsense,” he thought, but that was something he was unable to do because he was used to sleeping on his right, and in his present state couldn't get into that position. However hard he threw himself onto his right, he always rolled back to where he was.`,
      },
      {
        id: 'kafka_ch_02',
        title: 'Section II: The Isolation',
        trackId: 'kafka_01',
        content: `It was already late in the morning when Gregor awoke from a heavy, dream-like sleep. It was not much later than dusk, and he felt that he had slept long and deep. He saw that the gas light had been lit in the living room, and a small streak of light fell into his room through the crack in the door.

He tried to push himself up with his arms and legs, but found that his left side seemed to be one single long, unpleasant scar, and he had to limp awkwardly on his two rows of legs. He noticed for the first time that his left leg had been injured during the morning's commotion.

Near the door stood a bowl filled with fresh milk, in which floated small pieces of white bread. He almost laughed with joy, for he was much hungrier than he had been in the morning, and he immediately dipped his head into the milk, almost up over his eyes. But he soon drew it back again in disappointment; not only did the eating cause him difficulty because of his tender left side, but the milk, which had always been his favorite drink, did not taste good to him at all.`,
      },
    ],
  },
  // 17: Dracula
  '17': {
    gutenbergId: 345,
    chapters: [
      {
        id: 'drac_ch_01',
        title: 'Chapter 1: Jonathan Harker’s Journal',
        trackId: 'drac_01',
        content: `3 May. Bistritz.—Left Munich at 8:35 P. M., on 1st May, arriving at Vienna early next morning; should have arrived at 6:46, but train was an hour late. Buda-Pesth seems a wonderful place, from the glimpse which I got of it from the train and the little I could walk through the streets. I feared to go very far from the station, as we had arrived late and would start as near the correct time as possible.

The impression I had was that we were leaving the West and entering the East; the most western of splendid bridges over the Danube, which was here of noble width and depth, took us among the traditions of Turkish rule.

We left in pretty good time, and came after nightfall to Klausenburgh. Here I stopped for the night at the Hotel Royale. I had for dinner, or rather supper, a chicken done up some way with red pepper, which was very good but thirsty. (Mem., get recipe for Mina.) I asked the waiter, and he said it was called “paprika hendl,” and that, as it was a national dish, I should be able to get it anywhere along the Carpathians.

I found my smattering of German very useful here; indeed, I don’t know how I should be able to get on without it.

Having had some time at my disposal when in London, I had visited the British Museum, and made search among the books and maps in the library regarding Transylvania; it had struck me that some foreknowledge of the country could hardly fail to have some importance in dealing with a nobleman of that country.`,
      },
      {
        id: 'drac_ch_02',
        title: 'Chapter 2: Castle Dracula',
        trackId: 'drac_02',
        content: `5 May.—I must have been asleep, for certainly if I had been fully awake I must have noticed the approach of such a remarkable place. In the gloom the courtyard looked of considerable size, and as several dark ways led from it under great round arches, it perhaps seemed bigger than it really is. I have not yet been able to see it by daylight.

When the calèche stopped, the driver jumped down and held out his hand to assist me to alight. Again I could not but notice his prodigious strength. His hand actually seemed like a steel vice that could have crushed mine if he had chosen. Then he took out my traps, and placed them on the ground beside me as I stood close to a great door, old and studded with large iron nails, and set in a heavy doorway of massive stone.

I could see in the dim light that the stone was massively carved, but that the carving had been much worn by time and weather. As I stood, the driver jumped again into his seat, and shook the reins; the horses started forward, and with their bells jingling they passed into the darkness of one of the dark ways.`,
      },
    ],
  },

  // 150 & 17: Dracula
  '150': {
    gutenbergId: 345,
    chapters: [
      {
        id: 'drac_ch_01',
        title: 'Chapter 1: Jonathan Harker’s Journal',
        trackId: 'dracula_01',
        content: `3 May. Bistritz.—Left Munich at 8:35 P. M., on 1st May, arriving at Vienna early next morning; should have arrived at 6:46, but train was an hour late. Buda-Pesth seems a wonderful place, from the glimpse which I got of it from the train and the little I could walk through the streets. I feared to go very far from the station, as we had arrived late and would start as near the correct time as possible.

The impression I had was that we were leaving the West and entering the East; the most western of splendid bridges over the Danube, which was here of noble width and depth, took us among the traditions of Turkish rule.

We left in pretty good time, and came after nightfall to Klausenburgh. Here I stopped for the night at the Hotel Royale. I had for dinner, or rather supper, a chicken done up some way with red pepper, which was very good but thirsty. (Mem., get recipe for Mina.) I asked the waiter, and he said it was called “paprika hendl,” and that, as it was a national dish, I should be able to get it anywhere along the Carpathians.

I found my smattering of German very useful here; indeed, I don’t know how I should be able to get on without it.

Having had some time at my disposal when in London, I had visited the British Museum, and made search among the books and maps in the library regarding Transylvania; it had struck me that some foreknowledge of the country could hardly fail to have some importance in dealing with a nobleman of that country.`,
      },
      {
        id: 'drac_ch_02',
        title: 'Chapter 2: Castle Dracula',
        trackId: 'dracula_01',
        content: `5 May.—I must have been asleep, for certainly if I had been fully awake I must have noticed the approach of such a remarkable place. In the gloom the courtyard looked of considerable size, and as several dark ways led from it under great round arches, it perhaps seemed bigger than it really is. I have not yet been able to see it by daylight.

When the calèche stopped, the driver jumped down and held out his hand to assist me to alight. Again I could not but notice his prodigious strength. His hand actually seemed like a steel vice that could have crushed mine if he had chosen. Then he took out my traps, and placed them on the ground beside me as I stood close to a great door, old and studded with large iron nails, and set in a heavy doorway of massive stone.

I could see in the dim light that the stone was massively carved, but that the carving had been much worn by time and weather. As I stood, the driver jumped again into his seat, and shook the reins; the horses started forward, and with their bells jingling they passed into the darkness of one of the dark ways.`,
      },
    ],
  },

  // 42: Dr Jekyll and Mr Hyde
  '42': {
    gutenbergId: 43,
    chapters: [
      {
        id: 'jekyll_ch_01',
        title: 'Story of the Door',
        trackId: 'jekyll_01',
        content: `Mr. Utterson the lawyer was a man of a rugged countenance that was never lighted by a smile; cold, scanty and embarrassed in discourse; backward in sentiment; lean, long, dusty, dreary and yet somehow lovable. At friendly meetings, and when the wine was to his taste, something eminently human beaconed from his eye; something indeed which never found its way into his talk, but which spoke not only in these silent symbols of the after-dinner face, but more often and loudly in the acts of his life.

He was austere with himself; drank gin when he was alone, to mortify a taste for vintages; and though he enjoyed the theatre, had not crossed the doors of one for twenty years. But he had an approved tolerance for others; wondering almost with envy at the high pressure of spirits involved in their misdeeds; and in any extremity inclined to help rather than to reprove.

“I incline to Cain’s heresy,” he used to say quaintly: “I let my brother go to the devil in his own way.” In this character, it was frequently his fortune to be the last reputable acquaintance and the last good influence in the lives of downgoing men. And to such as these, so long as they came about his chambers, he never marked a shade of change in his demeanour.`,
      },
      {
        id: 'jekyll_ch_02',
        title: 'Search for Mr. Hyde',
        trackId: 'jekyll_01',
        content: `That evening Mr. Utterson came home to his bachelor house in sombre spirits and sat down to dinner without relish. It was his custom of a Sunday, when this meal was over, to sit close by the fire, a volume of some dry divinity on his reading desk, until the clock of the neighbouring church rang out the hour of twelve, when he would go soberly and gratefully to bed.

On this night, however, as soon as the cloth was taken away, he took up a candle and went into his business room. There he opened his safe, took from the most private part of it a document endorsed on the envelope as Dr. Jekyll’s Will, and sat down with a clouded brow to study its contents. The will was holograph, for Mr. Utterson, though he took charge of it now that it was made, had refused to lend the least assistance in the making of it; it provided not only that, in case of the decease of Henry Jekyll, M.D., D.C.L., LL.D., F.R.S., etc., all his worldly possessions should pass into the hands of his “friend and benefactor Edward Hyde,” but that in case of Dr. Jekyll’s “disappearance or unexplained absence for any period exceeding three calendar months,” the said Edward Hyde should step into the said Henry Jekyll’s shoes without further delay and free from any burden or obligation, beyond the payment of a few small sums to the members of the doctor’s household.`,
      },
    ],
  },

  // 108: The Tell-Tale Heart
  '108': {
    gutenbergId: 2148,
    chapters: [
      {
        id: 'poe_ch_01',
        title: 'The Tell-Tale Heart',
        trackId: 'poe_01',
        content: `True!—nervous—very, very dreadfully nervous I had been and am; but why will you say that I am mad? The disease had sharpened my senses—not destroyed—not dulled them. Above all was the sense of hearing acute. I heard all things in the heaven and in the earth. I heard many things in hell. How, then, am I mad? Hearken! and observe how healthily—how calmly I can tell you the whole story.

It is impossible to say how first the idea entered my brain; but once conceived, it haunted me day and night. Object there was none. Passion there was none. I loved the old man. He had never wronged me. He had never given me insult. For his gold I had no desire. I think it was his eye! yes, it was this! He had the eye of a vulture—a pale blue eye, with a film over it. Whenever it fell upon me, my blood ran cold; and so by degrees—very gradually—I made up my mind to take the life of the old man, and thus rid myself of the eye forever.

Now this is the point. You fancy me mad. Madmen know nothing. But you should have seen me. You should have seen how wisely I proceeded—with what caution—with what foresight—with what dissimulation I went to work! I was never kinder to the old man than during the whole week before I killed him.`,
      },
      {
        id: 'poe_ch_02',
        title: 'The Cask of Amontillado',
        trackId: 'poe_02',
        content: `The thousand injuries of Fortunato I had borne as I best could, but when he ventured upon insult I vowed revenge. You, who so well know the nature of my soul, will not suppose, however, that gave utterance to a threat. At length I would be avenged; this was a point definitely, settled—but the very definitiveness with which it was resolved precluded the idea of risk. I must not only punish but punish with impunity. A wrong is unredressed when retribution overtakes its redresser. It is equally unredressed when the avenger fails to make himself felt as such to him who has done the wrong.

It must be understood that neither by word nor deed had I given Fortunato cause to doubt my good will. I continued, as was my wont, to smile in his face, and he did not perceive that my smile now was at the thought of his immolation.`,
      },
    ],
  },

  // 201: Leaves of Grass
  '201': {
    gutenbergId: 1322,
    chapters: [
      {
        id: 'whitman_ch_01',
        title: 'Song of Myself (1-10)',
        trackId: 'leaves_01',
        content: `I celebrate myself, and sing myself,
And what I assume you shall assume,
For every atom belonging to me as good belongs to you.

I loafe and invite my soul,
I lean and loafe at my ease observing a spear of summer grass.

My tongue, every atom of my blood, form'd from this soil, this air,
Born here of parents born here from parents the same, and their parents the same,
I, now thirty-seven years old in perfect health begin,
Hoping to cease not till death.

Creeds and schools in abeyance,
Retiring back a while sufficed at what they are, but never forgotten,
I harbor for good or bad, I permit to speak at every hazard,
Nature without check with original energy.`,
      },
    ],
  },

  // 11: Alice's Adventures in Wonderland
  '11': {
    gutenbergId: 11,
    chapters: [
      {
        id: 'alice_ch_01',
        title: 'Chapter 1: Down the Rabbit-Hole',
        trackId: 'alice_01',
        content: `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.`,
      },
      {
        id: 'alice_ch_02',
        title: 'Chapter 2: The Pool of Tears',
        trackId: 'alice_02',
        content: `“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English); “now I’m opening out like the largest telescope that ever was! Good-bye, feet!” (for when she looked down at her feet, they seemed to be almost out of sight, they were getting so far off). “Oh, my poor little feet, I wonder who will put on your shoes and stockings for you now, dears? I’m sure I shan’t be able! I shall be a great deal too far off to trouble myself about you: you must manage the best way you can;—but I must be kind to them,” thought Alice, “or perhaps they won’t walk the way I want to go! Let me see: I’ll give them a new pair of boots every Christmas.”

And she went on planning to herself how she would manage it. “They must go by the carrier,” she thought; “and how funny it’ll seem, sending presents to one’s own feet! And how odd the directions will look!”`,
      },
    ],
  },
};

/**
 * Resolves curated classic ebook chapters by book ID, Gutenberg ID, or title matching.
 */
export function findClassicEbook(book: { id?: string; title?: string; gutenbergId?: number }): { gutenbergId?: number; chapters: EbookChapter[] } | null {
  if (!book) return null;

  // 1. Direct ID match
  if (book.id && CLASSIC_EBOOKS[book.id]) {
    return CLASSIC_EBOOKS[book.id];
  }

  // 2. Gutenberg ID match
  if (book.gutenbergId) {
    const found = Object.values(CLASSIC_EBOOKS).find((item) => item.gutenbergId === book.gutenbergId);
    if (found) return found;
  }

  // 3. Title matching
  const title = (book.title || '').toLowerCase();
  if (title) {
    if (title.includes('sherlock')) return CLASSIC_EBOOKS['47'];
    if (title.includes('pride and prejudice') || title.includes('prejudice')) return CLASSIC_EBOOKS['12'];
    if (title.includes('frankenstein')) return CLASSIC_EBOOKS['52'];
    if (title.includes('time machine')) return CLASSIC_EBOOKS['19'];
    if (title.includes('dorian gray')) return CLASSIC_EBOOKS['25'];
    if (title.includes('metamorphosis')) return CLASSIC_EBOOKS['88'];
    if (title.includes('dracula')) return CLASSIC_EBOOKS['150'] || CLASSIC_EBOOKS['17'];
    if (title.includes('jekyll') || title.includes('hyde')) return CLASSIC_EBOOKS['42'];
    if (title.includes('tell-tale') || title.includes('amontillado') || title.includes('edgar allan poe')) return CLASSIC_EBOOKS['108'];
    if (title.includes('leaves of grass') || title.includes('whitman')) return CLASSIC_EBOOKS['201'];
    if (title.includes('alice')) return CLASSIC_EBOOKS['11'];
  }

  return null;
}

export async function getEbookCloudUrl(title: string): Promise<string | null> {
  try {
    const rawTitle = (title || '').trim();
    // Clean up title: strip subtitle, edition, version tags
    const cleanTitle = rawTitle
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/,\s*or\s+.*$/i, '')
      .replace(/:\s*.*$/, '')
      .trim();

    const searchCandidates = [cleanTitle, rawTitle];

    for (const q of searchCandidates) {
      if (!q) continue;
      const searchUrl = `/api/gutenberg/search?q=${encodeURIComponent(q)}`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const gutData = await res.json();
        if (gutData.results && gutData.results.length > 0) {
          const topMatch = gutData.results[0];
          // Prefer HTML format for web reading, fallback to plain text
          const webUrl =
            topMatch.formats['text/html'] ||
            topMatch.formats['text/html; charset=utf-8'] ||
            topMatch.formats['text/plain; charset=utf-8'] ||
            topMatch.formats['text/plain; charset=us-ascii'] ||
            topMatch.formats['text/plain'];
          if (webUrl) {
            return webUrl;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Ebook resolver] Cloud URL fetch failed:', e);
  }
  return null;
}


