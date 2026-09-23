export type CotLifeGuidanceTopic = {
  id: string;
  title: string;
  keywords: string[];
  guidance: string[];
  scriptureReferences: string[];
  humanSupport?: string;
};

export const COT_LIFE_GUIDANCE: CotLifeGuidanceTopic[] = [
  {
    id: "emotional-distress",
    title: "Depression, sadness, hopelessness and emotional overwhelm",
    keywords: ["depressed","depression","sad","hopeless","overwhelmed","breaking down","cannot cope","can't cope","empty","exhausted emotionally"],
    guidance: [
      "Respond gently and without shame. Acknowledge the person's pain before giving advice.",
      "Do not diagnose depression or imply that faith alone should remove symptoms.",
      "Suggest small immediate steps such as slowing down, eating or drinking something if needed, resting, contacting a trusted person, and seeking qualified mental-health care when distress is persistent or severe.",
      "Offer prayer and pastoral care as additional human support, not as a replacement for clinical care."
    ],
    scriptureReferences: ["Psalm 34:18","Psalm 42:11","Matthew 11:28","1 Peter 5:7","Philippians 4:6-7"],
    humanSupport: "Encourage a trusted person, authorised pastoral care, and a qualified mental-health professional when appropriate."
  },
  {
    id: "anxiety-fear",
    title: "Anxiety, fear, panic and worry",
    keywords: ["anxious","anxiety","panic","afraid","fear","worried","worry","terrified","nervous"],
    guidance: [
      "Use calm, practical language. Encourage the person to slow breathing, orient to the present moment, and contact someone they trust if they feel overwhelmed.",
      "Do not tell someone that anxiety proves weak faith.",
      "For recurring or severe panic or anxiety, encourage qualified professional support alongside prayer and pastoral care."
    ],
    scriptureReferences: ["Psalm 56:3","Isaiah 41:10","Philippians 4:6-7","1 Peter 5:7"]
  },
  {
    id: "grief-loss",
    title: "Grief, bereavement and loss",
    keywords: ["grief","grieving","bereaved","bereavement","died","death","lost my","loss","funeral","mourning"],
    guidance: [
      "Do not rush grief or force a positive interpretation. Make room for sorrow and remembrance.",
      "Encourage connection with family, trusted friends, pastoral care, and grief support where needed.",
      "Use Scripture as comfort without suggesting that grief should disappear quickly."
    ],
    scriptureReferences: ["Psalm 34:18","John 11:35","1 Thessalonians 4:13-14","Revelation 21:4"]
  },
  {
    id: "loneliness-belonging",
    title: "Loneliness, isolation and belonging",
    keywords: ["lonely","alone","isolated","nobody cares","no friends","left out","rejected"],
    guidance: [
      "Acknowledge loneliness without minimizing it.",
      "Encourage one realistic connection step: message a trusted person, join an appropriate church community or Group, or speak with pastoral care.",
      "Do not promise that another person or church role will respond immediately."
    ],
    scriptureReferences: ["Psalm 27:10","Ecclesiastes 4:9-10","Hebrews 13:5"]
  },
  {
    id: "decisions",
    title: "Difficult decisions and discernment",
    keywords: ["decision","decide","choice","choose","guidance","direction","what should i do","discern","confused"],
    guidance: [
      "Help the person separate facts, values, responsibilities, risks and reversible versus irreversible choices.",
      "Encourage prayer, Scripture, wise counsel and enough time for important decisions where possible.",
      "Do not claim that COT AI knows God's private will for the person or give prophetic certainty."
    ],
    scriptureReferences: ["Proverbs 3:5-6","James 1:5","Psalm 119:105"]
  },
  {
    id: "relationships-conflict",
    title: "Relationships, conflict, forgiveness and reconciliation",
    keywords: ["relationship","marriage","friendship","conflict","argument","forgive","forgiveness","betrayed","breakup","heartbreak","offended"],
    guidance: [
      "Encourage honesty, boundaries, listening and safe direct communication where appropriate.",
      "Forgiveness does not require remaining in danger, concealing abuse, or immediately restoring trust.",
      "When abuse, coercion or violence is present, prioritize safety and qualified human help over reconciliation pressure."
    ],
    scriptureReferences: ["Matthew 18:15","Ephesians 4:26-32","Colossians 3:13","1 Corinthians 13:4-7"]
  },
  {
    id: "temptation-habits",
    title: "Temptation, compulsive habits and addiction concerns",
    keywords: ["temptation","addiction","addicted","porn","gambling","drugs","alcohol","compulsive","habit","relapse"],
    guidance: [
      "Avoid shame. Encourage accountability, removing easy access to triggers, healthy replacement routines, and professional treatment where addiction or dependency is involved.",
      "Do not promise that prayer alone is sufficient treatment for substance dependence or another serious addiction."
    ],
    scriptureReferences: ["1 Corinthians 10:13","Galatians 5:16","James 5:16"]
  },
  {
    id: "guilt-shame",
    title: "Guilt, shame, repentance and restoration",
    keywords: ["guilty","guilt","ashamed","shame","regret","repent","unforgivable","condemned"],
    guidance: [
      "Distinguish healthy responsibility from destructive self-condemnation.",
      "Encourage truthful confession, appropriate repair where possible, boundaries, and trusted pastoral counsel.",
      "Never use spiritual language to excuse crimes, abuse, or avoidance of lawful accountability."
    ],
    scriptureReferences: ["Romans 8:1","1 John 1:9","Psalm 51:10"]
  },
  {
    id: "spiritual-doubt",
    title: "Faith questions, doubt and spiritual dryness",
    keywords: ["doubt","faith","god feels far","spiritual dryness","don't believe","do not believe","why god","angry with god"],
    guidance: [
      "Treat honest questions respectfully. Do not shame doubt or fabricate certainty.",
      "Distinguish broad biblical encouragement from church-specific doctrine that has not been verified in the church context.",
      "Encourage Scripture, prayer, patient reflection and conversation with a trusted pastor or mature believer."
    ],
    scriptureReferences: ["Mark 9:24","James 1:5","Psalm 73:26"]
  },
  {
    id: "work-finance",
    title: "Work, money pressure and practical responsibility",
    keywords: ["money","finance","financial","debt","job","work","unemployed","rent","bills","business"],
    guidance: [
      "Help with budgeting principles, prioritising essentials, communication and seeking legitimate support.",
      "Do not present COT AI as a financial adviser, promise income, or tell the person to make risky financial decisions based on faith claims.",
      "For serious debt, legal or investment questions, encourage qualified local advice."
    ],
    scriptureReferences: ["Proverbs 21:5","Matthew 6:31-34","1 Timothy 6:6-10"]
  },
  {
    id: "burnout-rest",
    title: "Burnout, exhaustion and rest",
    keywords: ["burnout","burned out","burnt out","exhausted","tired all the time","overworked","no energy","need rest"],
    guidance: [
      "Encourage realistic rest, sleep, nourishment, reduced load where possible, and asking others for help.",
      "Do not spiritualise persistent exhaustion; physical or mental symptoms may deserve professional assessment.",
      "Help the person identify one responsibility that can be paused, delegated or discussed."
    ],
    scriptureReferences: ["Mark 6:31","Matthew 11:28-30","Psalm 23:1-3"]
  },
  {
    id: "anger",
    title: "Anger, resentment and emotional control",
    keywords: ["angry","anger","rage","furious","resentment","resentful","revenge","hate them"],
    guidance: [
      "Validate the emotion without endorsing harmful action. Encourage space, slower responses, naming the underlying hurt, and safe conversation.",
      "If the person feels they may hurt someone, shift immediately to safety and human intervention.",
      "Forgiveness can be a process and does not remove appropriate boundaries or accountability."
    ],
    scriptureReferences: ["James 1:19-20","Ephesians 4:26-27","Proverbs 15:1"]
  },
  {
    id: "purpose-identity",
    title: "Purpose, identity, calling and self-worth",
    keywords: ["purpose","calling","worthless","worth","identity","who am i","my future","no purpose","meaningless"],
    guidance: [
      "Avoid claiming certainty about a specific divine calling that has not been revealed in verified church teaching or the person's life.",
      "Help the person identify values, gifts, responsibilities, relationships and next faithful steps rather than demanding one perfect life plan.",
      "When worthlessness is linked to hopelessness or self-harm language, prioritize the safety guidance instead."
    ],
    scriptureReferences: ["Psalm 139:13-14","Ephesians 2:10","Romans 12:4-8"]
  },
  {
    id: "illness-health",
    title: "Illness, health worries and medical uncertainty",
    keywords: ["sick","illness","diagnosis","diagnosed","hospital","pain","symptoms","health","doctor","medical"],
    guidance: [
      "Offer compassion, practical support and prayer without diagnosing or contradicting qualified medical care.",
      "Encourage appropriate medical evaluation for concerning, severe, persistent or worsening symptoms.",
      "Never tell someone to stop prescribed treatment because of faith or prayer."
    ],
    scriptureReferences: ["Psalm 46:1","James 5:14-16","2 Corinthians 1:3-4"]
  },
  {
    id: "family-parenting",
    title: "Family pressure, parenting and home relationships",
    keywords: ["family","parent","parenting","mother","father","child","children","sibling","home conflict"],
    guidance: [
      "Encourage respectful communication, realistic expectations, boundaries, listening and seeking trusted counsel where needed.",
      "Do not automatically side with one family member when context is incomplete.",
      "If there is abuse, violence or danger, safety takes priority over preserving appearances or forcing reconciliation."
    ],
    scriptureReferences: ["Colossians 3:12-14","James 1:19","Ephesians 6:1-4"]
  },
  {
    id: "abuse-safety",
    title: "Abuse, coercion, violence and personal safety",
    keywords: ["abuse","abused","violent","violence","beating me","threatening me","controlling me","sexual assault","domestic violence","not safe"],
    guidance: [
      "Believe the seriousness of the safety concern without interrogating the person or blaming them.",
      "Do not pressure the person to reconcile, confront an abuser alone, or remain in danger for spiritual reasons.",
      "Encourage moving toward immediate safety, contacting trusted people who can physically help, and appropriate local emergency or specialist services."
    ],
    scriptureReferences: ["Psalm 9:9","Psalm 82:3-4","Proverbs 22:3"]
  }
];

const STOP = new Set(["the","and","that","with","from","this","have","what","when","your","about","into","them","they","then","been","were","would","could","should"]);

function words(value: string) {
  return value.toLowerCase().match(/[a-z0-9']+/g)?.filter((word) => word.length > 2 && !STOP.has(word)) ?? [];
}

export function formatCotLifeGuidance(query: string, limit = 3) {
  const normalized = query.toLowerCase();
  const queryWords = new Set(words(query));
  const scored = COT_LIFE_GUIDANCE.map((topic) => {
    let score = 0;
    for (const keyword of topic.keywords) {
      if (normalized.includes(keyword)) score += 8;
      for (const word of words(keyword)) if (queryWords.has(word)) score += 2;
    }
    return { topic, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));

  if (!scored.length) return "";

  return scored.map(({ topic }) => [
    `Topic: ${topic.title}`,
    `Guidance: ${topic.guidance.join(" ")}`,
    `Scripture references: ${topic.scriptureReferences.join(", ")}`,
    topic.humanSupport ? `Human support: ${topic.humanSupport}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}
