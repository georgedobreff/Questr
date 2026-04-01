
export function findIconForItem(itemName: string, keywords: string[], tagsMap: { [key: string]: string[] }): string {
  let bestMatch = 'token.png';
  let maxScore = 0;

  const nameKeywords = new Set(itemName.toLowerCase().split(' '));
  const allKeywords = new Set([...nameKeywords, ...keywords.map(k => k.toLowerCase())]);

  if (allKeywords.size === 0) {
    return bestMatch;
  }

  for (const [icon, tags] of Object.entries(tagsMap)) {
    let currentScore = 0;
    const iconName = icon.replace('.png', '');

    for (const keyword of allKeywords) {
      const isPremiumKeyword = keywords.includes(keyword);

      if (iconName.includes(keyword)) {
        currentScore += isPremiumKeyword ? 5 : 2;
      }
      if (tags.includes(keyword)) {
        currentScore += isPremiumKeyword ? 3 : 1;
      }
    }

    if (currentScore > maxScore) {
      maxScore = currentScore;
      bestMatch = icon;
    }
  }

  if (bestMatch === "abstract-1-121.png") {
    const randomNum = Math.floor(Math.random() * 121) + 1;
    return `abstract-${String(randomNum).padStart(3, '0')}.png`;
  }

  return bestMatch;
}
