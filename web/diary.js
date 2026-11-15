// 暖陽貓閣「📔 貓咪小日記」（Chuck 2026-11-15 確認）
// 小日記寫的是「現在」：貓咪用自己的口氣，寫在店裡的心情。書櫃「貓咪的過去」寫的是來店以前的故事（之後做）。
// 兩邊用同一條親密度進度：每隻貓 7 頁「心事」，親密度到 LV 裡的數字各解鎖一頁；第 2、5 頁會讓貓咪想起以前，
// 解鎖書櫃《X的過去》第 1、2 章（書櫃還沒做之前先顯示「書櫃即將開放」）。
// 7 隻原始貓有專屬心事；其他花色貓用 8 種個性的通用心事（本命貓第 1 頁換成專屬的一頁）。
// 另外每天打烊，親密度「喜歡」以上、今天有上班的貓會寫一句「每晚日記」，依今天真的發生的事組出來，出現在今日回憶。
// 存檔：G.diary = { r: { 貓id: 讀過的頁（bitmask）}, l: { 貓id: [[第幾天, 文字], …] } }，跟著存檔上雲端。
// 用到 index.html 的全域：G、S、BOND、CAT_DEFS、PERSONAS、catNameOf、catThumb、addBond、BOND_MAX、saveProgress、toast、sfx、renderPhone、$。
(function () {
  const LV = [25, 70, 150, 400, 1000, 2500, 9999];
  const BOOK_PAGE = { 1: 0, 4: 1 }; // page index -> bookshelf chapter
  const LOG_KEEP = 14;
  const READ_BOND = 5;

  // ---------- 原始 7 隻貓的心事：[一句話標題, 內文] ----------
  const ORIG = {
    orange: [
      ['……才不是因為肉泥。', '今天店長又多給我一條肉泥。\n我決定了，以後店長走到哪裡，我就跟到哪裡。\n……才不是因為肉泥。\n好啦，有一點點是因為肉泥。'],
      ['我已經不怕下雨了。', '今天外面一直下雨。\n店長抱我的時候，心跳咚、咚、咚的，\n跟以前紙箱外面的雨聲好像。\n以前聽到雨聲，我會縮成一小團。\n現在聽到雨聲，我就去找店長。\n我已經不怕下雨了。'],
      ['躺成一顆橘子的作戰。', '我發現店長累的時候，會偷偷嘆一口氣。\n所以我就躺在店長腳邊，躺成圓圓的一顆橘子。\n店長跨不過去，只好蹲下來摸我。\n然後店長就笑了。\n作戰成功。'],
      ['這叫做幸福的形狀。', '{tux}說我變胖了。\n{tux}不懂，這不是胖。\n這是每天被摸摸、吃飽飽、睡暖暖，\n慢慢長出來的「幸福的形狀」。'],
      ['那個聲音，我記得。', '今天店長在講電話，\n電話那頭的聲音說：「乖孫喔～有沒有好好吃飯？」\n我的耳朵一下子豎起來。\n是巷口的奶奶！以前每天傍晚，餵我吃飯的那個奶奶。\n原來，我一直住在奶奶的家人身邊。'],
      ['我要當店裡的招財貓。', '最近客人越來越多了。\n我每天坐在門口，舉起一隻腳，\n客人說：「哇，招財貓！」\n其實我只是在舔腳。\n不過如果店長開心，我願意一直舉著。'],
      ['謝謝你撿到我。', '我常常在想，\n如果那天下雨，奶奶沒有把紙箱抱回屋簷下，\n如果那天店長沒有打開這扇門，\n我現在會在哪裡呢？\n不想了。我現在在這裡，在{m}旁邊。\n這就是最好的地方。'],
    ],
    tux: [
      ['我只是剛好路過。', '店長摸我的時候，我沒有呼嚕。\n真的沒有。\n那個呼嚕呼嚕的聲音，是冰箱。\n……明天店長還會摸我嗎？我只是問問。'],
      ['我以前也有過觀眾。', '今天有客人拍手，因為我從貓跳台優雅地跳下來。\n那個聲音好熟悉。\n很久以前，我住在一間老戲院的後台，\n每天晚上，都有好多好多拍手聲。'],
      ['燕尾服是要穿給重要的人看的。', '我的毛天生就像一套燕尾服。\n以前我覺得沒什麼。\n可是今天店長說：「{me}今天好帥！」\n我就多舔了三次胸口的白毛。'],
      ['{orange}其實不笨。', '{orange}每天都在想吃的。\n我以前覺得{orange}很笨。\n可是昨天晚上我做惡夢，\n是{orange}默默把身體靠過來，讓我取暖。\n……我收回那句話。一半。'],
      ['戲院關門的那一天。', '老戲院關門的那天，大家都走了，\n燈一盞一盞熄掉，只剩下我。\n我在空空的舞台上，對著空空的座位鞠了一個躬。\n現在每天晚上打烊，我也會對店長鞠一個躬。\n因為這裡，是我的新舞台。'],
      ['我教新來的貓怎麼優雅。', '新來的貓咪走路都好吵。\n我教牠們：尾巴要翹高，腳步要輕，\n跳下來的時候，落地不能有聲音。\n店長在旁邊偷笑。我知道。\n我裝作沒看到。'],
      ['不用拍手也沒關係。', '以前我以為，要有人拍手，我才是一隻好貓。\n可是在這裡，就算我什麼都沒表演，\n只是趴在窗邊睡覺，{m}也會走過來摸摸我。\n原來，被愛不需要表演。'],
    ],
    fluffy: [
      ['高高的地方最好睡。', '我最喜歡睡在高高的地方。\n可以看到整間店，看到客人，看到店長忙來忙去。\n今天我發現，從上面看，店長的頭頂有一撮毛翹起來。\n好可愛。zzz……'],
      ['我以前是一朵雲。', '以前，有一個老爺爺很喜歡畫畫。\n他說我白白蓬蓬的，像一朵雲，\n每天讓我睡在窗台上，當他的模特兒。\n今天店長說我「像一顆棉花糖」。\n我覺得，雲比較好聽。'],
      ['店長的膝蓋是第二名。', '全世界最好睡的地方排行榜：\n第一名，貓跳台最上面。\n第二名，店長的膝蓋。\n第三名，客人剛坐過的暖暖坐墊。\n店長的膝蓋會一直動，所以還是第二名。'],
      ['我會醒著陪你。', '打烊以後，店長一個人在算錢，\n眼睛快要閉起來了。\n我很想睡，可是我撐著不睡，坐在旁邊陪店長。\n……後來是店長把我抱回窩裡的。\n我好像還是睡著了。'],
      ['老爺爺來了。', '今天有一位拄著拐杖的老爺爺走進店裡。\n他看到我，愣了好久，然後笑著說：「小雲，你過得好嗎？」\n是畫畫的老爺爺！\n老爺爺搬去跟女兒住，那裡不能養貓，才把我送走。\n他說他每天都在想我。我也是。'],
      ['我在雲上面做夢。', '我夢到自己變成一朵真的雲，\n飄過整條巷子，飄過店的屋頂。\n往下看，店裡亮亮的、暖暖的。\n我就從天上掉下來，咚，掉回店長懷裡。\n醒來，發現真的在店長懷裡。'],
      ['有兩個家，是很幸福的事。', '老爺爺寄來了一張畫，\n畫的是我睡在{shop}的貓跳台上。\n店長把畫掛在牆上。\n以前的家，現在的家，\n都有人在想我。'],
    ],
    calico: [
      ['當一隻三花貓好辛苦。', '今天又有好多客人說「好可愛！」\n我轉一圈，他們就尖叫。\n我再轉一圈，他們又尖叫。\n當一隻三花貓，真是辛苦的工作呢。'],
      ['我是在市場長大的。', '店長去市場買菜回來，身上有魚的味道、菜的味道、好多人的味道。\n我一直聞一直聞。\n我小時候，就住在那樣熱鬧的市場裡，\n賣魚的阿伯每天會分我一小塊魚。'],
      ['店長有時候也想被摸摸。', '客人們一直摸我，我很開心。\n可是我發現，從來沒有人摸摸店長的頭。\n所以今天，我用我的頭，用力地蹭了店長的手。\n店長愣了一下，然後說：「謝謝你喔，{me}。」'],
      ['我交到了好朋友。', '有一個小女孩每個禮拜六都會來。\n她很害羞，不太講話，\n可是她摸我的時候，手好溫柔。\n今天她跟我說了一個秘密：「我在學校也交到朋友了喔。」\n我好替她開心。'],
      ['媽媽的味道。', '市場改建那年，好多大機器開進來，\n我跟媽媽、兄弟姊妹都跑散了。\n今天店長新洗的毯子，有一股太陽曬過的味道，\n跟媽媽的肚子一模一樣。\n我在毯子上睡了一整個下午，夢到媽媽在舔我的頭。'],
      ['我是店裡的迎賓大使。', '我決定了，每天客人進來，我都要第一個去打招呼。\n笑一個（貓咪也會笑的），尾巴豎高高。\n店長說我是「{shop}的迎賓大使」。\n這個名字好長，可是我很喜歡。'],
      ['熱鬧的地方，就是家。', '我喜歡熱鬧。\n以前市場很熱鬧，可是那不是我的家。\n現在店裡也很熱鬧，有客人、有貓咪、有{m}。\n吵吵鬧鬧、暖暖呼呼的。\n這裡，就是我的家。'],
    ],
    gray: [
      ['中間那層剛剛好。', '貓跳台最上面太高，最下面太吵。\n中間那一層，剛剛好。\n可以看到店長，店長也看得到我，\n可是不會有人一直來摸我。\n剛剛好。'],
      ['書的味道。', '今天有客人坐在角落看書，\n翻頁的聲音，沙、沙、沙。\n我把鼻子靠過去，聞到紙的味道。好懷念。\n以前我住在一間小小的圖書館，\n每天睡在故事書中間。'],
      ['我第一次主動走過去。', '我很怕陌生人。\n可是今天店長坐在樓梯上休息的時候，\n我自己走過去，坐在店長旁邊。\n沒有喵，沒有蹭，就只是坐著。\n店長也沒有說話，只是輕輕摸了一下。這樣就夠了。'],
      ['安靜的人也很好。', '有一個客人每次來，都一個人安靜地喝咖啡。\n我今天坐在那位客人的腳邊，\n陪他喝完一整杯咖啡。\n他走的時候，偷偷跟我說了謝謝。\n安靜的人，也很好。'],
      ['借書證上的名字。', '圖書館的館長阿姨，以前幫我做了一張借書證，\n上面寫著：「讀者：{me}。可借閱：陽光。」\n後來圖書館搬走了，我沒能跟著去。\n今天店長說：「{me}，這裡的陽光，你想借多久都可以。」'],
      ['我也會說故事。', '晚上大家都睡了，我會小聲地跟新來的小貓說故事。\n說以前在圖書館聽到的故事，\n公主、恐龍、會飛的鯨魚。\n小貓都聽到睡著了。\n我覺得，我好像變成館長阿姨了。'],
      ['不害羞，只對你。', '我還是很怕吵，很怕陌生人。\n可是現在，只要{m}叫我的名字，\n我就會從貓跳台跳下來，\n一步一步走過去。\n不害羞，只對你。'],
    ],
    tabby: [
      ['我是巷子裡最快的貓！', '今天我從 1F 衝到 2F，只花了三秒！\n客人都嚇一跳。\n店長說：「{me}，不要在店裡跑！」\n……好吧，那我用走的。\n快快地走。'],
      ['我以前住在屋頂上。', '以前我是屋頂上的探險家。\n從這個屋頂跳到那個屋頂，\n晚上看月亮，早上追鴿子。\n今天店長打開窗戶，風吹進來，\n有屋頂的味道。'],
      ['抓到了！是店長的鞋帶。', '店長的鞋帶一直晃來晃去，\n我忍了好久，終於撲上去！\n店長差點跌倒，可是沒有生氣，\n還拿了逗貓棒陪我玩了好久。\n明天我還要撲。'],
      ['我也會累。', '大家都以為我永遠不會累。\n其實玩了一整天，我也想找個地方躺下來。\n今天我第一次在店長的腳邊睡著。\n原來，不用一直跑，也很好。'],
      ['迷路的那一晚。', '有一次我追一隻鴿子，追得太遠，\n回頭的時候，全部的屋頂都長得不一樣了。\n我在雨裡走了好幾天，又餓又冷，\n最後看到一扇亮著燈的窗戶。\n那扇窗戶，就是{shop}。'],
      ['我是店裡的保鑣。', '晚上有奇怪的聲音，我第一個衝去看。\n原來是風吹動了門口的招牌。\n不過沒關係，我還是很認真地巡邏了一整圈。\n保護{m}和大家，是保鑣的工作。'],
      ['最棒的探險。', '我去過好多好多屋頂，看過好多好多月亮。\n可是最棒的探險，\n是每天早上醒來，衝下樓，\n看到{m}打開店門說：「早安，{me}！」'],
    ],
    milk: [
      ['我會在門口等你。', '每天早上，我都坐在 1F 門口。\n客人進來，我說歡迎光臨。\n店長出門，我說路上小心。\n店長回來，我說：你終於回來了！我等好久了！'],
      ['我以前也在等一個人。', '以前我有一個主人，是個大哥哥。\n每天放學，我都坐在門口等他回家。\n後來有一天，他提著大大的行李箱出門，\n就再也沒有回來了。\n所以我很喜歡門口，也很怕門口。'],
      ['店長出門，有回來。', '今天店長出門了。\n我在門口坐了好久好久。\n門鈴響了，是店長！店長真的回來了！\n我繞著店長的腳轉了十圈。\n店長說：「我一定會回來的啊。」我知道了。'],
      ['黏人不是壞事。', '{tux}說我太黏人了，一點都不酷。\n可是我想跟喜歡的人待在一起，\n這有什麼不對呢？\n店長摸著我說：「我喜歡黏人的{me}。」\n你看吧。'],
      ['大哥哥的留言。', '原來大哥哥是去很遠的國家念書了。\n他把我託給親戚，親戚沒辦法照顧，我才被送到中途之家。\n今天店長說，有人在網路上看到店裡的照片，\n留言說：「那是我的貓！牠過得好幸福，謝謝你們。」\n我沒有被忘記。'],
      ['我學會了說再見。', '以前，我最討厭說再見。\n現在，每個客人離開，我都會送到門口，\n因為我知道，他們會再回來的。\n再見，不是不見。'],
      ['不用再等了。', '以前我一直在等。\n等門打開，等腳步聲，等一個人回家。\n現在不用等了。\n因為{m}每天都在這裡，\n而我，也在這裡。'],
    ],
  };
  // 書櫃《X的過去》的章節名（第 2 頁 -> 第 1 章，第 5 頁 -> 第 2 章）
  const BOOKS = {
    orange: ['下雨天的紙箱', '巷口的咖啡奶奶'], tux: ['老戲院的後台', '最後一場謝幕'], fluffy: ['窗台上的雲朵', '老爺爺的畫'],
    calico: ['市場的人氣王', '跑散的那一天'], gray: ['圖書館的角落', '借書證上的名字'], tabby: ['屋頂上的探險家', '迷路的那一晚'], milk: ['等門的貓', '大哥哥的留言'],
  };

  // ---------- 其他花色貓：8 種個性（順序跟 PERSONAS 一樣）的通用心事 ----------
  const PERS = [
    [ // 黏人
      ['我想一直待在你旁邊。', '今天我跟著店長走了一整天。\n店長去廚房，我也去。店長上樓，我也上樓。\n店長說：「{me}，你是我的影子嗎？」\n對啊，我是。'],
      ['中途之家的小籠子。', '以前在中途之家，我住在一個小小的籠子裡。\n每天都有人走過來看我，又走開。\n我一直把臉貼在籠子上，希望有人摸摸我。\n現在，我想被摸多久都可以。'],
      ['你的手是魔法。', '店長的手好神奇。\n摸摸頭，我就不緊張了。\n摸摸下巴，我就呼嚕呼嚕。\n摸摸背，我就想睡覺。\n一定是魔法。'],
      ['你都有看到。', '今天店長很忙，都沒空摸我。\n我有一點點難過。\n可是打烊後，店長抱著我說：「今天謝謝你乖乖的。」\n原來店長都有看到。'],
      ['被選上的那一天。', '我記得那天，店長蹲在籠子前面，看了我好久。\n然後說：「就是你了。」\n那是我這輩子聽過，最好聽的一句話。'],
      ['我學會分享你了。', '以前我只想要店長摸我一個。\n可是現在，看到店長摸別的貓，我也不會生氣了。\n因為我知道，店長的心很大，\n裝得下我們每一隻。'],
      ['影子永遠在。', '不管店長走到哪裡，\n我都會在旁邊，像影子一樣。\n天亮的時候在，天黑的時候也在。\n這是我跟{m}的約定。'],
    ],
    [ // 貪吃
      ['今天的肉泥是鮪魚口味。', '今天的肉泥是鮪魚口味，五顆星。\n昨天的雞肉口味，四顆星。\n店長，明天可以吃鮭魚口味嗎？\n我會給五顆星，再多一顆愛心。'],
      ['以前常常餓肚子。', '以前在外面流浪，常常好幾天沒有東西吃。\n所以現在看到碗裡有飯，我都吃得很快很快。\n店長說：「慢慢吃，沒有人跟你搶。」\n我知道了。可是我還是吃很快。'],
      ['我在廚房門口站崗。', '每次店長走進廚房，\n我就坐在門口，眼睛亮亮地看著。\n不是要偷吃喔，我是在保護廚房。\n……如果有掉下來的東西，那就不算偷吃了吧？'],
      ['我把最好的禮物給你。', '今天我抓到一隻飛進店裡的小蟲，\n我沒有吃掉，叼去放在店長腳邊。\n店長尖叫了一聲。\n奇怪，那可是我最好的禮物呢。'],
      ['第一碗熱熱的飯。', '來到店裡的第一天，店長給了我一碗熱熱的飯。\n我一邊吃，一邊覺得眼睛酸酸的。\n那不是因為飯很燙，\n是因為，我終於有一個不會餓肚子的家了。'],
      ['幸福是有味道的。', '幸福是什麼味道呢？\n是早上剛烤好的餅乾香，\n是店長手上淡淡的咖啡味，\n是曬過太陽的坐墊。\n還有，鮪魚肉泥。'],
      ['吃飽飽，就是愛。', '店長每天都讓我吃飽飽。\n我也想讓店長吃飽飽。\n所以今天，我把我的貓糧推到店長面前。\n店長笑到流眼淚。\n我是真的很愛你喔，{m}。'],
    ],
    [ // 愛睡
      ['我今天睡了十六個小時。', '我今天睡了十六個小時。\n剩下的八個小時，我在想要睡哪裡。\n店長說我是「睡覺冠軍」。\n冠軍要繼續努力。zzz……'],
      ['以前不敢睡熟。', '以前在外面，我從來不敢睡熟，\n一有聲音就要醒來，跑掉。\n現在我可以翻開肚子，呼呼大睡，\n因為我知道，這裡很安全。'],
      ['我在夢裡也看到你。', '我夢到我在一片大草原上，\n追著一顆毛線球跑。\n跑著跑著，前面出現了店長。\n醒來的時候，店長真的在摸我的頭。'],
      ['你也要好好睡覺。', '店長最近都很晚才睡。\n我很擔心。\n所以今天，我睡在店長的枕頭旁邊，\n用呼嚕聲唱搖籃曲。\n店長很快就睡著了。'],
      ['最安全的地方。', '第一次來店裡那天，我躲在箱子裡不敢出來。\n店長沒有逼我，只是在箱子旁邊放了一條小毯子。\n那天晚上，我第一次睡了一個不會做惡夢的覺。'],
      ['打瞌睡也是一種工作。', '客人說，看我睡覺好療癒。\n所以我決定，認真地睡，努力地睡，\n讓每一個客人都覺得好放鬆。\n這是我在{shop}的工作。'],
      ['醒來的時候，你都在。', '每次我醒來，\n睜開眼睛，第一個看到的都是店長。\n有時候在忙，有時候在笑，有時候在看我。\n所以我才敢一直睡。\n因為{m}都在。'],
    ],
    [ // 活潑
      ['客人來了！客人來了！', '門鈴一響，我就衝過去！\n客人來了！客人來了！\n今天我陪了好多客人玩，\n每一個都說下次還要來找我。'],
      ['以前沒有人陪我玩。', '以前在中途之家，大家都在睡覺。\n我想玩，可是沒有人陪我。\n我只好一直追自己的尾巴，追到頭暈。\n現在，有好多好多客人陪我玩！'],
      ['我會在空中轉一圈。', '今天我練習了一個新招式：\n撲逗貓棒的時候，在空中轉一圈！\n客人拍手拍好大聲。\n店長說：「{me}好厲害！」我要再多練十次。'],
      ['讓哭哭的人笑出來。', '今天有一位客人進來的時候，眼睛紅紅的。\n我跑過去，在客人腳邊翻了一個肚子。\n客人愣了一下，然後噗哧一聲笑出來了。\n我覺得今天，我做了一件很棒的事。'],
      ['回家的路上，我一直在叫。', '店長帶我回來那天，\n我在提籃裡一路喵喵叫，叫了一整路。\n不是因為害怕，\n是因為我太開心了，開心到停不下來。'],
      ['我是店裡的開心果。', '店長說，我是{shop}的開心果。\n開心果是什麼？\n好像是一種很好吃的堅果。\n不管了，聽起來就很開心！'],
      ['一起玩一輩子。', '我想跟{m}一起玩，\n玩逗貓棒、玩紙箱、玩躲貓貓，\n玩到我們都老老的，\n也還要一起玩。'],
    ],
    [ // 害羞
      ['我偷偷看了你一整天。', '我躲在貓跳台後面，偷偷看了店長一整天。\n店長在泡咖啡，在送甜點，在跟客人笑。\n店長發現我的時候，我趕快把頭縮回去。\n可是，我還想再看。'],
      ['我以前很怕人的手。', '以前，有人的手對我不好。\n所以我很怕人伸手過來。\n店長每次都把手放低低的，等我自己靠過去。\n今天，我靠過去了。'],
      ['我讓你摸了尾巴。', '尾巴是我最寶貝的地方，\n我從來不讓人摸。\n今天店長輕輕摸了一下，我沒有跑走。\n心臟跳得好快，可是，不討厭。'],
      ['我也可以很勇敢。', '今天門外有一隻好大的狗，一直汪汪叫。\n大家都嚇到了。\n我躲到店長後面，可是沒有逃走。\n店長說：「{me}好勇敢。」\n我會記住這句話。'],
      ['躲在沙發底下的那三天。', '剛來的時候，我在沙發底下躲了三天。\n店長每天都在沙發旁邊放飯、放水，\n還小小聲地跟我說話。\n第四天，我出來了。\n因為我想看看，那個溫柔的聲音長什麼樣子。'],
      ['我交到第一個貓朋友了。', '以前我不敢靠近別的貓。\n今天，有一隻貓咪在我旁邊趴下來，\n我們一起曬太陽，誰都沒說話。\n我想，這就是朋友吧。'],
      ['你的聲音最好聽。', '世界上有好多聲音讓我害怕。\n打雷、吸塵器、大聲說話。\n可是有一個聲音，我一聽到就安心。\n那就是{m}叫我名字的聲音。'],
    ],
    [ // 好奇
      ['店裡有好多秘密。', '今天我發現 1F 櫃檯下面有一個小洞，\n2F 的坐墊底下有一根羽毛，\n店長的口袋裡有一顆餅乾屑。\n這間店，有好多秘密等著我去發現。'],
      ['我以前住在一個大紙箱裡。', '以前我住在路邊一個大紙箱裡。\n每天探頭出去看，外面的世界好大好大。\n現在我住在{shop}裡，\n每天探頭出去看，店裡的世界也好大好大。'],
      ['我想知道你在做什麼。', '店長在做甜點的時候，我一定要跳上去看。\n麵粉是什麼？奶油是什麼？為什麼會變香香的？\n店長把我抱下來三次，\n我又跳上去三次。'],
      ['窗外的世界。', '今天我坐在窗邊看了一整個下午。\n看鳥飛過去，看雲飄過去，看客人走過去。\n店長走過來，陪我一起看。\n跟店長一起看的窗外，比較好看。'],
      ['好奇心帶我找到你。', '那天下大雨，我聞到一股香香的味道，\n就一直走一直走，走到了一扇門前。\n門打開，是店長。\n如果不是我那麼好奇，我們就不會遇見了。'],
      ['我畫了一張地圖。', '我在心裡畫了一張{shop}的地圖。\n哪裡最暖，哪裡最涼，哪裡可以偷看客人，\n哪裡會有掉下來的餅乾。\n地圖的正中間，寫著「店長」。'],
      ['最想知道的事。', '我對好多事情都很好奇。\n可是現在，我最想知道的是：\n{m}，你今天開心嗎？\n如果不開心，我可以陪你。'],
    ],
    [ // 優雅
      ['我允許你摸我了。', '今天，我允許店長摸我的頭了。\n只摸了三下。\n不要太得意喔，店長。\n……明天可以摸四下。'],
      ['我曾經住在大房子裡。', '以前我住在一間很大很漂亮的房子，\n有絲絨的坐墊，有水晶的碗。\n可是那裡好安靜，安靜到我常常忘記自己的聲音。\n這裡沒有水晶碗，可是很熱鬧，很溫暖。'],
      ['優雅的貓也會撒嬌。', '優雅的貓，是不撒嬌的。\n可是今天店長蹲下來的時候，\n我不小心，蹭了一下店長的手。\n……是不小心的。真的。'],
      ['我為你整理了毛。', '今天我花了一整個早上，把每一根毛都舔得亮亮的。\n店長說：「{me}今天特別漂亮。」\n當然。我是為了你。\n（這句不要給店長看到。）'],
      ['被留下的那一天。', '那間大房子的主人搬走了，\n沒有帶走我。\n我在空空的客廳裡，坐了好久好久。\n後來是中途之家的人來接我，\n再後來，我遇見了{m}。'],
      ['我教客人怎麼喝咖啡。', '我坐在客人對面，看著他們喝咖啡。\n小口小口地喝，才是優雅。\n有個客人學我，慢慢地喝完了一杯。\n他說：「好像比較好喝了。」\n那當然。'],
      ['真正的優雅。', '以前我以為，優雅就是要很漂亮、很安靜。\n現在我知道了，\n真正的優雅，是在喜歡的人身邊，\n不用假裝，也很自在。'],
    ],
    [ // 調皮
      ['那個杯子不是我推的。', '櫃檯上有一個杯子掉下來了。\n不是我推的。\n是它自己想去地板上看看。\n……好啦，是我推的。'],
      ['我以前是巷子裡的小霸王。', '以前在巷子裡，我是最調皮的小霸王。\n追狗、爬牆、跳垃圾桶，什麼都敢。\n可是晚上一個人的時候，其實有點寂寞。\n現在晚上，有店長陪我。'],
      ['躲貓貓我最厲害。', '今天我躲在紙箱裡，\n店長找了我好久好久。\n找到的時候，店長說：「嚇死我了！」\n然後抱我抱得好緊。\n下次我還要躲。'],
      ['我會說對不起。', '今天我把店長的毛線球拉得亂七八糟。\n店長看著地板，嘆了一口氣。\n我走過去，用頭蹭了蹭店長的腳。\n這是貓咪的對不起。\n店長原諒我了。'],
      ['被抓去中途之家的那天。', '我被帶去中途之家的那天，\n大鬧了一場，抓破了兩個人的袖子。\n後來店長來看我，我也想抓。\n可是店長只是笑著說：「好有精神喔。」\n我就抓不下去了。'],
      ['調皮是因為想要你看我。', '其實我知道，推杯子是不對的。\n可是每次我調皮，店長就會看我，\n叫我的名字，走過來。\n……我只是想要多一點點注意啦。'],
      ['最喜歡的惡作劇。', '我最喜歡的惡作劇，\n是趁{m}睡覺的時候，偷偷鑽進被窩裡。\n早上{m}醒來，會嚇一跳，然後笑出來。\n這是我們兩個的秘密。'],
    ],
  ];
  const HONMEI_PAGE = ['我知道你是因為我才來的。', '聽說，{m}做了一個測驗，\n才知道我是{m}的本命貓。\n我不知道測驗是什麼，\n可是我第一眼看到{m}，就知道了。\n我們，本來就是要遇見的。'];

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const st = () => { if (!G.diary || typeof G.diary !== 'object') G.diary = { r: {}, l: {} }; G.diary.r = G.diary.r || {}; G.diary.l = G.diary.l || {}; return G.diary; };
  const def = id => CAT_DEFS[id];
  const bondV = id => G.bond[id] || 0;
  const lvTitle = at => (BOND.find(b => b.at === at) || {}).title || '';
  const fill = (s, id) => s.replace(/\{(\w+)\}/g, (m, k) => esc(k === 'me' ? catNameOf(id) : k === 'm' ? G.mgrName : k === 'shop' ? G.shopName : CAT_DEFS[k] ? catNameOf(k) : m));
  function pages(id) {
    const d = def(id); if (!d) return [];
    if (d.orig && ORIG[d.base]) return ORIG[d.base];
    const p = (PERS[d.pers] || PERS[0]).slice();
    if (d.honmei) p[0] = HONMEI_PAGE;
    return p;
  }
  const book = (id, i) => { const d = def(id); return d && d.orig && BOOKS[d.base] && BOOK_PAGE[i] != null ? { ch: BOOK_PAGE[i] + 1, title: BOOKS[d.base][BOOK_PAGE[i]] } : null; };
  const opened = id => LV.filter(at => bondV(id) >= at).length;
  const isRead = (id, i) => !!((st().r[id] || 0) & (1 << i));
  const unreadN = id => { let n = 0; for (let i = 0; i < opened(id); i++) if (!isRead(id, i)) n++; return n; };
  const unread = id => !!(G && def(id) && G.cats.some(c => c.id === id) && unreadN(id) > 0);
  const anyUnread = () => !!(G && G.cats.some(c => unread(c.id)));

  function markRead(id, i) {
    if (isRead(id, i)) return false;
    st().r[id] = (st().r[id] || 0) | (1 << i);
    if (S && S.startG) { const sd = S.startG.diary || (S.startG.diary = { r: {}, l: {} }); sd.r = sd.r || {}; sd.r[id] = (sd.r[id] || 0) | (1 << i);
      if (S.startG.bond) S.startG.bond[id] = Math.min(BOND_MAX, (S.startG.bond[id] || 0) + READ_BOND); }
    const k = S && S.cats && S.cats.find(c => c.id === id);
    if (k) addBond(k, READ_BOND); else G.bond[id] = Math.min(BOND_MAX, bondV(id) + READ_BOND);
    saveProgress();
    return true;
  }

  // ---------- 每晚日記 ----------
  const CLOSERS = [
    ['明天也要跟在店長後面。', '希望明天店長也摸摸我。', '我還想再被抱抱。'],
    ['明天的早餐會是什麼呢？', '睡前想著鮪魚，一定會做好夢。', '肚子飽飽，晚安。'],
    ['好睏……晚安。zzz', '今天也睡得很飽。', '明天要找一個新的睡覺地方。'],
    ['明天也要玩個夠！', '好想快點天亮喔！', '今天也是開心的一天！'],
    ['今天有一點點勇敢。', '明天想再靠近店長一點。', '安靜的晚上，最舒服了。'],
    ['明天要去探險一個新角落。', '不知道明天會來什麼客人？', '今天又發現了一個新秘密。'],
    ['今天的我，也很優雅。', '晚安，店長。（小聲）', '明天也要漂漂亮亮的。'],
    ['明天要想新的惡作劇。', '今天只推了一個杯子，很乖吧。', '嘿嘿，明天見。'],
  ];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function lineFor(k, T) {
    const id = k.id, d = def(id), pets = (T.pets || {})[id] || 0, fed = (T.catFed || {})[id] || 0, play = (T.catPlay || {})[id] || 0;
    const night = S.close && S.close.night && S.close.night[id], guests = (T.ratings || []).length;
    const s = [];
    if (S.wx === 'rain') s.push(pick(['今天下雨，客人比較少，', '外面一直下雨，']) + (pets ? `店長摸了我 ${pets} 次。` : '我在窗邊看雨。'));
    else if (pets >= 6) s.push(`今天被店長摸了 ${pets} 次，${pick(['好開心。', '頭頂都要被摸禿了。', '是最棒的一天。'])}`);
    else if (pets) s.push(`今天店長摸了我 ${pets} 次。`);
    else s.push(guests >= 15 ? '今天店裡好多客人，店長好忙。' : '今天店長好忙，都沒空摸我。');
    if (fed) s.push(`客人餵我吃了${fed > 1 ? ` ${fed} 次` : ''}肉泥，${pick(['五顆星！', '好好吃！', '舔得乾乾淨淨。'])}`);
    else if (play) s.push(`陪客人玩了 ${play} 次，${pick(['有一位客人一直笑。', '好累，可是好好玩。', '我是最受歡迎的貓。'])}`);
    if (night) s.push('睡前店長跟我說了晚安。');
    else s.push(pick(CLOSERS[d.pers] || CLOSERS[0]));
    return s.slice(0, 3).join('');
  }
  // closeDay: write tonight's line for every cat at work today that likes the manager; returns the one to show in 今日回憶
  function night(T, day) {
    if (!S || !S.cats) return null;
    const D = st(); let best = null;
    for (const k of S.cats) {
      if (!def(k.id) || bondV(k.id) < LV[0]) continue;
      const t = lineFor(k, T), log = D.l[k.id] || (D.l[k.id] = []);
      if (log.length && log[log.length - 1][0] === day) log[log.length - 1] = [day, t]; else log.push([day, t]);
      while (log.length > LOG_KEEP) log.shift();
      const score = (T.bond[k.id] || 0) + Math.random();
      if (!best || score > best.score) best = { id: k.id, t, score };
    }
    return best;
  }
  const memRow = b => b ? `<div class="memrow dymem"><span class="ic"><img src="assets/diary_nb.webp" alt="" style="width:42px;margin:-4px"></span><span><small>${esc(catNameOf(b.id))}今晚的小日記</small><br><span class="dyhand">${esc(b.t)}</span></span></div>` : '';

  // ---------- 等級提升的時候 ----------
  function levelUp(k, at) {
    if (!LV.includes(at)) return;
    setTimeout(() => toast(`📔 ${k.name}寫了一頁新的心事，點牠頭上的小本子看看！`), 2200);
  }

  // ---------- 打開的日記本 ----------
  let pageAt = 0, curId = null, fromWorld = false;
  const ov = document.createElement('div'); ov.className = 'dyov'; ov.hidden = true; document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  const css = document.createElement('style');
  css.textContent = `
.dyov{position:fixed;inset:0;z-index:30;background:rgba(50,36,28,.62);display:flex;align-items:center;justify-content:center;padding:16px;flex-direction:column;gap:10px}
.dyov[hidden]{display:none}
.dybook{position:relative;width:min(960px,100%);max-height:calc(100% - 60px);display:flex;background:#B9774A;border-radius:16px;padding:12px;box-shadow:0 18px 40px rgba(0,0,0,.45);background-image:radial-gradient(#C7885A 1px,transparent 1px);background-size:6px 6px}
.dypg{flex:1;position:relative;background:#FFFCF4;padding:26px 30px;overflow:auto;background-image:repeating-linear-gradient(transparent 0 31px,#EADFCC 31px 32px);background-position:0 18px}
.dypg.l{border-radius:8px 0 0 8px;box-shadow:inset -16px 0 22px -14px rgba(120,80,40,.35)}
.dypg.r{border-radius:0 8px 8px 0;box-shadow:inset 16px 0 22px -14px rgba(120,80,40,.35);display:flex;flex-direction:column;align-items:center;gap:10px}
.dyhead{font-family:var(--display);color:#A0806A;font-size:15px;display:flex;justify-content:space-between;gap:8px}
.dyq{font-family:var(--display);font-size:22px;font-weight:700;color:#8B5A3C;margin-top:14px}
.dytxt{font-family:var(--display);font-size:19px;line-height:32px;margin-top:8px;color:#4A3428;white-space:pre-line}
.dysig{display:flex;align-items:flex-end;gap:8px;font-family:var(--display);color:#A0806A;margin-top:12px}
.dypol{background:#fff;padding:10px 10px 8px;transform:rotate(2deg);box-shadow:0 4px 10px rgba(0,0,0,.18);margin-top:14px;text-align:center;position:relative;min-width:150px}
.dypol:before{content:'';position:absolute;left:50%;top:-12px;width:80px;height:22px;background:rgba(230,210,170,.8);transform:translateX(-50%) rotate(-4deg)}
.dypol .cap{font-family:var(--display);color:#8B6B55;font-size:15px;margin-top:4px}
.dymemo{font-family:var(--display);font-size:16px;color:#8B6B55;text-align:center}
.dygo{background:#7E9A6C;color:#fff;border-radius:12px;padding:10px 14px;font-size:15px;font-weight:700;text-align:center;line-height:1.5}
.dygo small{display:block;font-weight:400;opacity:.9}
.dygain{color:#D0605A;font-size:14px;text-align:center}
.dylock{font-family:var(--display);font-size:19px;color:#A99888;text-align:center;margin-top:40px;line-height:1.8}
.dynav{display:flex;gap:10px;align-items:center;color:#fff}
.dynav button{min-width:96px}
.dyhand{font-family:var(--display);font-size:16px;line-height:1.6}
.dymem{background:#FFF8EE;border-color:#E9CFB0}
.dylist .item.new{border:2px solid #E07A7A;background:#FFF6F2}
.dylist .item.lock{opacity:.6}
.dylist .q{font-family:var(--display);font-size:15px;margin-top:2px}
@media (max-width:720px){.dybook{flex-direction:column;overflow:auto}.dypg{flex:none;overflow:visible;padding:20px 20px}.dypg.l{border-radius:8px 8px 0 0;box-shadow:none}.dypg.r{border-radius:0 0 8px 8px;box-shadow:inset 0 14px 18px -14px rgba(120,80,40,.3)}.dytxt{font-size:17px;line-height:30px}.dypol img{max-height:110px;width:auto!important}}
`;
  document.head.appendChild(css);

  function render() {
    const id = curId, P = pages(id), n = opened(id), i = pageAt, d = def(id), name = esc(catNameOf(id));
    let L, R;
    if (i < n) {
      const [q, b] = P[i], first = markRead(id, i), bk = book(id, i);
      L = `<div class="dyhead"><span>第 ${i + 1} 頁・${lvTitle(LV[i])}</span><span>${name}的小日記</span></div><div class="dyq">「${fill(q, id)}」</div><div class="dytxt">${fill(b, id)}</div>
        <div class="dysig">${catThumb(d, 52)}<span>— ${name}</span></div>`;
      R = `<div class="dypol">${catThumb(d, 130)}<div class="cap">${name}・${lvTitle(LV[i])}</div></div>` +
        (bk ? `<div class="dymemo">${name}想起了來店裡以前的事……</div><div class="dygo">📖 這段回憶會寫進書櫃《${name}的過去》<br>第 ${bk.ch} 章「${esc(bk.title)}」<small>書櫃即將開放</small></div>` : '') +
        (first ? `<div class="dygain">♥ 第一次讀這頁：${name}親密度 +${READ_BOND}</div>` : '');
    } else {
      L = `<div class="dyhead"><span>第 ${i + 1} 頁・${lvTitle(LV[i])}</span><span>🔒</span></div><div class="dylock">這一頁還是空白的。<br>親密度到 ${LV[i].toLocaleString()}（${lvTitle(LV[i])}），<br>${name}就會寫下新的心事。</div>`;
      R = `<div class="dypol" style="opacity:.55">${catThumb(d, 130)}<div class="cap">現在親密度 ${bondV(id).toLocaleString()}</div></div>`;
    }
    ov.innerHTML = `<div class="dybook"><div class="dypg l">${L}</div><div class="dypg r">${R}</div></div>
      <div class="dynav"><button id="dyPrev" ${i ? '' : 'disabled'}>‹ 上一頁</button><span>${i + 1} / ${LV.length}</span><button id="dyNext" ${i < LV.length - 1 ? '' : 'disabled'}>下一頁 ›</button><button id="dyClose">關閉</button></div>`;
    ov.querySelector('#dyPrev').onclick = () => { if (pageAt > 0) { pageAt--; sfx && sfx('app_switch'); render(); } };
    ov.querySelector('#dyNext').onclick = () => { if (pageAt < LV.length - 1) { pageAt++; sfx && sfx('app_switch'); render(); } };
    ov.querySelector('#dyClose').onclick = close;
  }
  // open the book of a cat: at `page`, or the first unread page, or the newest one
  function open(id, page) {
    if (!def(id)) return;
    curId = id; const n = opened(id);
    let p = page; if (p == null) { p = 0; while (p < n && isRead(id, p)) p++; if (p >= n) p = Math.max(0, n - 1); }
    pageAt = Math.max(0, Math.min(LV.length - 1, p));
    fromWorld = $('phoneOv').hidden; if (fromWorld && S) S.uiPause = true;
    ov.hidden = false; render();
  }
  function close() {
    ov.hidden = true;
    if (fromWorld) { if (S && $('chooseOv').hidden) S.uiPause = false; } else if (typeof renderPhone === 'function') renderPhone();
  }

  // ---------- 喵喵家族裡的「小日記」頁 ----------
  const D = { cur: null, tab: 'pages' };
  function phone() {
    const id = D.cur, d = def(id); if (!d) { D.cur = null; return ''; }
    const P = pages(id), n = opened(id), v = bondV(id), name = esc(catNameOf(id)), nx = LV[n];
    let h = `<div class="row" style="margin:0 0 6px;gap:6px"><button id="dyBack">‹ 我的貓</button></div>
      <div class="item"><div class="top"><span class="nm">${catThumb(d, 40)} ${name}的小日記</span><b>♥ ${v}</b></div>
      <div class="sub">${BOND[BOND.filter(b => v >= b.at).length - 1].title}・心事 ${n}/${LV.length} 頁${nx ? `・親密度到 ${nx.toLocaleString()} 會寫下一頁` : '・全部寫完了！'}</div></div>
      <div class="row" style="margin:0 0 6px;gap:6px"><button data-dytab="pages" ${D.tab === 'pages' ? 'class="primary"' : ''}>心事 ${n}/${LV.length}</button><button data-dytab="log" ${D.tab === 'log' ? 'class="primary"' : ''}>每晚日記</button></div><div class="dylist">`;
    if (D.tab === 'pages') {
      h += P.map(([q], i) => {
        const bk = book(id, i);
        if (i >= n) return `<div class="item lock"><div class="top"><span class="sub">第 ${i + 1} 頁・${lvTitle(LV[i])}</span><span class="sub">🔒 親密度 ${LV[i].toLocaleString()}</span></div><div class="q">？？？</div>${bk ? `<div class="sub">📖 會解鎖書櫃第 ${bk.ch} 章</div>` : ''}</div>`;
        const nw = !isRead(id, i);
        return `<div class="item${nw ? ' new' : ''}" data-dyp="${i}" style="cursor:pointer"><div class="top"><span class="sub">第 ${i + 1} 頁・${lvTitle(LV[i])}</span><span class="sub">${nw ? '<b style="color:#D0605A">NEW 點一下讀</b>' : '已讀'}</span></div><div class="q">「${fill(q, id)}」</div>${bk ? `<div class="sub" style="color:#6E8B5E">📖 書櫃《${name}的過去》第 ${bk.ch} 章（即將開放）</div>` : ''}</div>`;
      }).join('');
    } else {
      const log = (st().l[id] || []).slice().reverse();
      h += log.length ? log.map(([day, t]) => `<div class="item"><div class="sub">第 ${day} 天</div><div class="dyhand">${esc(t)}</div></div>`).join('')
        : `<p class="muted">${v < LV[0] ? `親密度到 ${LV[0]}（喜歡）以後，${name}每天打烊都會寫一句日記。` : `今天打烊以後，${name}就會寫下第一篇日記。`}</p>`;
    }
    return h + '</div>';
  }
  function bind(sc) {
    sc.querySelectorAll('[data-diary]').forEach(b => b.onclick = () => { D.cur = b.dataset.diary; D.tab = 'pages'; sfx && sfx('app_switch'); renderPhone(); });
    sc.querySelectorAll('[data-dyp]').forEach(b => b.onclick = () => open(D.cur, +b.dataset.dyp));
    sc.querySelectorAll('[data-dytab]').forEach(b => b.onclick = () => { D.tab = b.dataset.dytab; renderPhone(); });
    const bk = sc.querySelector('#dyBack'); if (bk) bk.onclick = () => { D.cur = null; renderPhone(); };
  }
  const btn = id => `<button data-diary="${id}">📔 小日記${unread(id) ? ' <b style="color:#D0605A">●</b>' : ''}</button>`;

  const icon = new Image(); icon.src = 'assets/diary_nb.webp';
  window.DIARY = Object.assign(D, { LV, open, unread, anyUnread, night, memRow, levelUp, phone, bind, btn, icon, pages, opened });
})();
