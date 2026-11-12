export const CAT_CONFIG = {
  '병원·건강': { c: '#0E7C66', s: '#DDF3EC', icon: 'heart' },
  '일·직장':   { c: '#1F4FB8', s: '#E1E9FA', icon: 'work'  },
  '돈·요금':   { c: '#B4520A', s: '#FCEBDD', icon: 'won'   },
  '학교·아이': { c: '#2E7D1E', s: '#E4F3DF', icon: 'school' },
  '나라·복지': { c: '#6B3FA8', s: '#EEE5F8', icon: 'gov'   },
  '비자·체류': { c: '#24407A', s: '#E2E8F4', icon: 'globe' },
  '기타':      { c: '#4A5066', s: '#ECECE6', icon: 'doc'   },
};

export const CATEGORIES = ['전체', ...Object.keys(CAT_CONFIG)];
export const SUGGESTIONS = ['일하는거', '돈 내는거', '병원', '손주 학교'];
