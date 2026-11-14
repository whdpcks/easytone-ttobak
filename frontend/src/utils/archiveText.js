/* ─────────────────────────────────────────────
   D 화면(보관함·결과·상세) 문구 번역 — A의 i18n 사전(DICT)에 D 키를 더합니다.
   A 파일을 건드리지 않으려고 따로 둡니다. 화면에서는 그대로 useT()의 t('d.…')를 씁니다.
   - 한국어·영어 외 번역은 원어민 확인 전 초안입니다. (A와 같은 규칙)
   - 문서 내용(제목·요약 등)은 C의 번역 API가 번역합니다. 여기는 화면 글자만.
   - 지금은 한국어·영어·일본어·중국어만 지원합니다. 다른 말을 고르면 D 화면은 영어로 보여요.
     (언어 버튼은 A 화면에 12개 그대로 — 지원 언어를 늘리려면 아래 사전과 D_LANGS에 추가)
───────────────────────────────────────────── */
import { DICT } from '../common/i18n';

const CAT_KEYS = ['전체', '병원·건강', '일·직장', '돈·요금', '학교·아이', '나라·복지', '비자·체류', '기타'];
const cats = (names) => Object.fromEntries(CAT_KEYS.map((k, i) => [`d.cat.${k}`, names[i]]));

const ko = {
  'd.title': '보관함', 'd.guide': '보관함이에요. 찾고 싶은 것을 적거나, 추천 검색어를 눌러주세요.',
  'd.foundVoice': '"{q}"와 관련된 문서를 {n}개 찾았어요. {titles}.', 'd.noneVoice': '관련된 문서를 못 찾았어요.',
  'd.searchErr': '검색 중 오류가 났어요. 다시 시도해주세요.', 'd.searchPh': '예: 일하는거, 병원', 'd.searchAria': '검색어',
  'd.mic': '말로 찾기', 'd.find': '찾기', 'd.sugg1': '일하는거', 'd.sugg2': '돈 내는거', 'd.sugg3': '병원', 'd.sugg4': '손주 학교',
  'd.catAria': '카테고리 필터', 'd.thinking': '"{q}"의 뜻을 생각하는 중…',
  'd.understood': '"{q}"를 {c} 관련으로 이해했어요. 문서 {n}개를 찾았어요.',
  'd.noResult': '"{q}"와 관련된 문서를 못 찾았어요. 다른 말로 찾아보세요.', 'd.showAll': '전체 목록 보기',
  'd.emptyCat': '{c} 문서가 없어요.', 'd.empty': '아직 찍어둔 문서가 없어요.', 'd.open': '보기', 'd.openAria': '{title} 보기',
  'd.reading': '아직 종이를 읽고 있어요. 잠시 뒤에 다시 열어주세요.', 'd.notFound': '이 문서를 찾지 못했어요.', 'd.goBack': '뒤로 가기',
  'd.translating': '지금 쓰는 말로 바꾸는 중…', 'd.fallback': '번역하지 못해서 한국어 원문을 보여드려요.', 'd.retry': '다시 번역하기',
  'd.intro': '{title}이에요. {s} 보고 싶은 내용을 눌러주세요.', 'd.pick': '보고 싶은 내용을 눌러주세요',
  'd.t.summary': '문서 요약', 'd.t.datetime': '날짜·시간', 'd.t.place': '장소', 'd.t.items': '준비물',
  'd.t.cautions': '주의할 점', 'd.t.contact': '연락처', 'd.t.category': '카테고리',
  'd.count': '{n}가지', 'd.checkPaper': '종이를 확인해주세요', 'd.moreAria': '{x} 자세히 보기',
  'd.glance': '한눈에 보기', 'd.noDate': '날짜 정보가 없어요.', 'd.allDay': '하루 종일',
  'd.dleft': '{n}일 남았어요', 'd.today': '오늘이에요!', 'd.past': '지났어요', 'd.checkAgain': '종이를 한 번 더 확인해주세요', 'd.remind': '알림 받기', 'd.remindDone': '달력에 넣을 일정을 만들었어요. 열어서 추가하면 하루 전과 1시간 전에 알려드려요', 'd.remindDoneDay': '달력에 넣을 일정을 만들었어요. 열어서 추가하면 전날과 당일 아침에 알려드려요', 'd.remindPast': '이미 지난 날이라 알림을 드릴 수 없어요',
  'd.noPlace': '장소 정보가 없어요.', 'd.whereTo': '가야 할 곳', 'd.address': '주소', 'd.route': '길 찾기', 'd.routeDemo': '지도 앱으로 길을 찾아요 (시연)',
  'd.itemsH': '챙길 것 {n}가지', 'd.itemsSub': '챙긴 것을 눌러 표시하세요. ({c}/{n})', 'd.cautionsH': '꼭 지켜주세요',
  'd.noContact': '연락처 정보가 없어요.', 'd.callH': '궁금하면 전화하세요', 'd.call': '전화 걸기',
  'd.kindH': '이 종이의 종류', 'd.change': '바꾸기', 'd.changeDemo': '종류를 바꿀 수 있어요 (시연)',
  'd.same': '같은 종류 문서', 'd.sameEmpty': '아직 같은 종류 문서가 없어요.', 'd.other': '다른 내용 보기',
  'v.summary': '문서 요약이에요. {s}', 'v.date': '{label}는 {when}이에요.', 'v.dateLabel': '날짜', 'v.dleft': '{n}일 남았어요.',
  'v.place': '장소는 {name}이에요.', 'v.items': '챙길 것은 {n}가지예요. {list}.', 'v.cautions': '주의할 점이에요. {list}',
  'v.nth': '{i}번, {c}', 'v.contact': '{name}전화번호는 {phone}이에요.', 'v.category': '이 종이는 {c} 종류예요.',
  ...cats(['전체', '병원·건강', '일·직장', '돈·요금', '학교·아이', '나라·복지', '비자·체류', '기타']),
};

const en = {
  'd.title': 'My papers', 'd.guide': 'These are your saved papers. Type what you are looking for, or tap a suggestion.',
  'd.foundVoice': 'I found {n} papers about "{q}". {titles}.', 'd.noneVoice': 'I could not find a related paper.',
  'd.searchErr': 'Something went wrong while searching. Please try again.', 'd.searchPh': 'e.g. work, hospital', 'd.searchAria': 'Search words',
  'd.mic': 'Search by voice', 'd.find': 'Search', 'd.sugg1': 'Work', 'd.sugg2': 'Bills to pay', 'd.sugg3': 'Hospital', 'd.sugg4': "Kids' school",
  'd.catAria': 'Category filter', 'd.thinking': 'Thinking about what "{q}" means…',
  'd.understood': 'I understood "{q}" as {c}. I found {n} papers.',
  'd.noResult': 'I could not find papers about "{q}". Try other words.', 'd.showAll': 'See all papers',
  'd.emptyCat': 'No {c} papers.', 'd.empty': 'You have not scanned any papers yet.', 'd.open': 'Open', 'd.openAria': 'Open {title}',
  'd.reading': 'Still reading the paper. Please open it again in a moment.', 'd.notFound': 'I could not find this paper.', 'd.goBack': 'Go back',
  'd.translating': 'Changing it into your language…', 'd.fallback': 'Translation failed, so this is the original in Korean.', 'd.retry': 'Translate again',
  'd.intro': 'This is "{title}". {s} Tap what you want to see.', 'd.pick': 'Tap what you want to see',
  'd.t.summary': 'Summary', 'd.t.datetime': 'Date · Time', 'd.t.place': 'Place', 'd.t.items': 'What to bring',
  'd.t.cautions': 'Be careful', 'd.t.contact': 'Contact', 'd.t.category': 'Category',
  'd.count': '{n} things', 'd.checkPaper': 'Check the paper', 'd.moreAria': 'More about {x}',
  'd.glance': 'At a glance', 'd.noDate': 'There is no date.', 'd.allDay': 'All day',
  'd.dleft': '{n} days left', 'd.today': "It's today!", 'd.past': 'Already passed', 'd.checkAgain': 'Please check the paper once more', 'd.remind': 'Remind me', 'd.remindDone': 'Calendar event ready. Open it and add it to get reminders a day and an hour before', 'd.remindDoneDay': 'Calendar event ready. Open it and add it to get reminders the morning before and on the day', 'd.remindPast': 'This date has already passed, so no reminder can be set',
  'd.noPlace': 'There is no place.', 'd.whereTo': 'Where to go', 'd.address': 'Address', 'd.route': 'Directions', 'd.routeDemo': 'Opens a map app for directions (demo)',
  'd.itemsH': '{n} things to bring', 'd.itemsSub': 'Tap what you have packed. ({c}/{n})', 'd.cautionsH': 'Please keep these',
  'd.noContact': 'There is no contact.', 'd.callH': 'Call if you have questions', 'd.call': 'Call',
  'd.kindH': 'Type of this paper', 'd.change': 'Change', 'd.changeDemo': 'You can change the type (demo)',
  'd.same': 'Papers of the same type', 'd.sameEmpty': 'No other papers of this type yet.', 'd.other': 'See other parts',
  'v.summary': 'Here is the summary. {s}', 'v.date': '{label}: {when}.', 'v.dateLabel': 'The date', 'v.dleft': '{n} days left.',
  'v.place': 'The place is {name}.', 'v.items': 'Bring {n} things. {list}.', 'v.cautions': 'Be careful about these. {list}',
  'v.nth': 'Number {i}, {c}', 'v.contact': '{name}The phone number is {phone}.', 'v.category': 'This paper is about {c}.',
  ...cats(['All', 'Hospital·Health', 'Work·Job', 'Money·Bills', 'School·Kids', 'Government·Welfare', 'Visa·Stay', 'Other']),
};

const zh = {
  'd.title': '我的文件', 'd.guide': '这里是保存的文件。请输入想找的内容，或点推荐词。',
  'd.foundVoice': '找到了{n}个和"{q}"有关的文件。{titles}。', 'd.noneVoice': '没有找到相关的文件。',
  'd.searchErr': '搜索时出错了，请再试一次。', 'd.searchPh': '例：工作、医院', 'd.searchAria': '搜索词',
  'd.mic': '语音搜索', 'd.find': '搜索', 'd.sugg1': '工作', 'd.sugg2': '要交的钱', 'd.sugg3': '医院', 'd.sugg4': '孩子学校',
  'd.catAria': '分类筛选', 'd.thinking': '正在理解"{q}"的意思…',
  'd.understood': '我把"{q}"理解为 {c}。找到了{n}个文件。',
  'd.noResult': '没有找到和"{q}"有关的文件。请换个说法。', 'd.showAll': '查看全部',
  'd.emptyCat': '没有{c}的文件。', 'd.empty': '还没有拍过文件。', 'd.open': '查看', 'd.openAria': '查看{title}',
  'd.reading': '还在读这张纸，请稍后再打开。', 'd.notFound': '找不到这个文件。', 'd.goBack': '返回',
  'd.translating': '正在换成您的语言…', 'd.fallback': '翻译失败，显示的是韩语原文。', 'd.retry': '重新翻译',
  'd.intro': '这是"{title}"。{s} 请点想看的内容。', 'd.pick': '请点想看的内容',
  'd.t.summary': '文件摘要', 'd.t.datetime': '日期·时间', 'd.t.place': '地点', 'd.t.items': '要带的东西',
  'd.t.cautions': '注意事项', 'd.t.contact': '联系方式', 'd.t.category': '分类',
  'd.count': '{n}项', 'd.checkPaper': '请确认原件', 'd.moreAria': '详细查看{x}',
  'd.glance': '一眼看懂', 'd.noDate': '没有日期信息。', 'd.allDay': '全天',
  'd.dleft': '还剩{n}天', 'd.today': '就是今天！', 'd.past': '已经过了', 'd.checkAgain': '请再确认一次原件', 'd.remind': '设置提醒', 'd.remindDone': '已生成日历日程。打开并添加后，会在前一天和前一小时提醒您', 'd.remindDoneDay': '已生成日历日程。打开并添加后，会在前一天早上和当天早上提醒您', 'd.remindPast': '日期已经过了，无法设置提醒',
  'd.noPlace': '没有地点信息。', 'd.whereTo': '要去的地方', 'd.address': '地址', 'd.route': '查路线', 'd.routeDemo': '用地图应用查路线（演示）',
  'd.itemsH': '要带{n}样东西', 'd.itemsSub': '准备好的请点一下。（{c}/{n}）', 'd.cautionsH': '请一定遵守',
  'd.noContact': '没有联系方式。', 'd.callH': '有疑问请打电话', 'd.call': '打电话',
  'd.kindH': '这张纸的种类', 'd.change': '更改', 'd.changeDemo': '可以更改种类（演示）',
  'd.same': '同类文件', 'd.sameEmpty': '还没有同类文件。', 'd.other': '看其他内容',
  'v.summary': '这是文件摘要。{s}', 'v.date': '{label}是{when}。', 'v.dateLabel': '日期', 'v.dleft': '还剩{n}天。',
  'v.place': '地点是{name}。', 'v.items': '要带{n}样东西。{list}。', 'v.cautions': '注意事项。{list}',
  'v.nth': '第{i}，{c}', 'v.contact': '{name}电话号码是{phone}。', 'v.category': '这张纸属于{c}。',
  ...cats(['全部', '医院·健康', '工作·职场', '钱·费用', '学校·孩子', '政府·福利', '签证·居留', '其他']),
};

const ja = {
  'd.title': '保管箱', 'd.guide': '保存した書類です。探したいものを入力するか、おすすめの言葉を押してください。',
  'd.foundVoice': '「{q}」に関する書類が{n}件見つかりました。{titles}。', 'd.noneVoice': '関係する書類が見つかりませんでした。',
  'd.searchErr': '検索中にエラーが起きました。もう一度お試しください。', 'd.searchPh': '例：仕事、病院', 'd.searchAria': '検索ワード',
  'd.mic': '声で探す', 'd.find': '探す', 'd.sugg1': '仕事', 'd.sugg2': '払うお金', 'd.sugg3': '病院', 'd.sugg4': '子どもの学校',
  'd.catAria': 'カテゴリー', 'd.thinking': '「{q}」の意味を考えています…',
  'd.understood': '「{q}」を {c} のことだと理解しました。書類が{n}件見つかりました。',
  'd.noResult': '「{q}」に関する書類が見つかりませんでした。別の言葉で探してください。', 'd.showAll': 'すべて見る',
  'd.emptyCat': '{c}の書類はありません。', 'd.empty': 'まだ撮った書類がありません。', 'd.open': '見る', 'd.openAria': '{title}を見る',
  'd.reading': 'まだ書類を読んでいます。少ししてから開いてください。', 'd.notFound': 'この書類が見つかりませんでした。', 'd.goBack': '戻る',
  'd.translating': 'あなたの言葉に変えています…', 'd.fallback': '翻訳できなかったので、韓国語の原文を表示しています。', 'd.retry': 'もう一度翻訳',
  'd.intro': '「{title}」です。{s} 見たい内容を押してください。', 'd.pick': '見たい内容を押してください',
  'd.t.summary': '書類の要約', 'd.t.datetime': '日付・時間', 'd.t.place': '場所', 'd.t.items': '持ち物',
  'd.t.cautions': '注意すること', 'd.t.contact': '連絡先', 'd.t.category': 'カテゴリー',
  'd.count': '{n}個', 'd.checkPaper': '書類を確認してください', 'd.moreAria': '{x}を詳しく見る',
  'd.glance': 'ひと目で見る', 'd.noDate': '日付の情報がありません。', 'd.allDay': '終日',
  'd.dleft': 'あと{n}日', 'd.today': '今日です！', 'd.past': '過ぎました', 'd.checkAgain': '書類をもう一度確認してください', 'd.remind': 'お知らせを受ける', 'd.remindDone': 'カレンダーの予定を作りました。開いて追加すると、前日と1時間前にお知らせします', 'd.remindDoneDay': 'カレンダーの予定を作りました。開いて追加すると、前日の朝と当日の朝にお知らせします', 'd.remindPast': 'もう過ぎた日なので、お知らせできません',
  'd.noPlace': '場所の情報がありません。', 'd.whereTo': '行く場所', 'd.address': '住所', 'd.route': '道案内', 'd.routeDemo': '地図アプリで道を調べます（デモ）',
  'd.itemsH': '持ち物 {n}個', 'd.itemsSub': '用意したものを押して印をつけてください。（{c}/{n}）', 'd.cautionsH': '必ず守ってください',
  'd.noContact': '連絡先の情報がありません。', 'd.callH': 'わからないときは電話してください', 'd.call': '電話をかける',
  'd.kindH': 'この書類の種類', 'd.change': '変える', 'd.changeDemo': '種類を変えられます（デモ）',
  'd.same': '同じ種類の書類', 'd.sameEmpty': 'まだ同じ種類の書類はありません。', 'd.other': 'ほかの内容を見る',
  'v.summary': '書類の要約です。{s}', 'v.date': '{label}は{when}です。', 'v.dateLabel': '日付', 'v.dleft': 'あと{n}日です。',
  'v.place': '場所は{name}です。', 'v.items': '持ち物は{n}個です。{list}。', 'v.cautions': '注意することです。{list}',
  'v.nth': '{i}番、{c}', 'v.contact': '{name}電話番号は{phone}です。', 'v.category': 'この書類は{c}の種類です。',
  ...cats(['すべて', '病院・健康', '仕事・職場', 'お金・料金', '学校・子ども', '行政・福祉', 'ビザ・在留', 'その他']),
};

const D_TEXT = { ko, en, zh, ja };
for (const [lang, entries] of Object.entries(D_TEXT)) {
  if (DICT[lang]) Object.assign(DICT[lang], entries);
}

/** D 화면이 실제로 지원하는 말. 그 외 언어는 영어로 보여줌 (화면 글자는 i18n이 알아서 영어로 대체) */
export const D_LANGS = ['ko', 'en', 'ja', 'zh'];
export const docLang = (lang) => (D_LANGS.includes(lang) ? lang : 'en');

/** 카테고리 보이는 이름 (데이터의 category는 한국어 키 그대로) */
export function catLabel(t, category) {
  const key = `d.cat.${category}`;
  const label = t(key);
  return label === key ? category : label;
}

/** 추천 검색어 4개 (지금 언어) */
export const suggestions = (t) => [t('d.sugg1'), t('d.sugg2'), t('d.sugg3'), t('d.sugg4')];
