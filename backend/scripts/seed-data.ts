/**
 * Seed data: publicly known landmark judgments of the Supreme Court of India.
 * Only bibliographic facts and short original summaries are included. Judgment text is NOT reproduced,
 * and the PDFs generated for demonstration are clearly labelled as demonstration material.
 */
export interface SeedCase {
  title: string;
  caseNumber: string;
  citation: string;
  court: string;
  year: number;
  category: string;
  petitioner: string;
  respondent: string;
  bench: string;
  decisionDate: string;
  summary: string;
  keyHoldings: string[];
  tags: string[];
  status: 'PUBLISHED' | 'PENDING';
  withDocument: boolean;
}

const SOURCE = 'https://main.sci.gov.in/judgments';

export const SOURCE_URL = SOURCE;

export const seedCases: SeedCase[] = [
  {
    title: 'Kesavananda Bharati v. State of Kerala',
    caseNumber: 'Writ Petition (Civil) 135 of 1970',
    citation: '(1973) 4 SCC 225; AIR 1973 SC 1461',
    court: 'Supreme Court of India',
    year: 1973,
    category: 'Constitutional Law',
    petitioner: 'His Holiness Kesavananda Bharati Sripadagalvaru',
    respondent: 'State of Kerala',
    bench: 'Thirteen-judge Constitution Bench headed by S.M. Sikri, C.J.',
    decisionDate: '1973-04-24',
    summary:
      'A thirteen-judge Constitution Bench considered how far Parliament may amend the Constitution under Article 368, in the context of Kerala land reform laws. By a narrow majority the Court held that Parliament has wide power to amend the Constitution, including fundamental rights, but cannot alter or destroy its basic structure. The decision is the origin of the basic structure doctrine.',
    keyHoldings: [
      'Parliament may amend any provision of the Constitution under Article 368.',
      'The amending power does not extend to altering the basic structure or framework of the Constitution.',
      'Amendments are subject to judicial review against the basic structure.',
    ],
    tags: ['basic structure', 'article 368', 'amendment power', 'fundamental rights'],
    status: 'PUBLISHED',
    withDocument: true,
  },
  {
    title: 'Maneka Gandhi v. Union of India',
    caseNumber: 'Writ Petition (Civil) 231 of 1977',
    citation: '(1978) 1 SCC 248; AIR 1978 SC 597',
    court: 'Supreme Court of India',
    year: 1978,
    category: 'Constitutional Law',
    petitioner: 'Maneka Gandhi',
    respondent: 'Union of India',
    bench: 'Seven-judge Constitution Bench headed by M.H. Beg, C.J.',
    decisionDate: '1978-01-25',
    summary:
      'The petitioner challenged the impounding of her passport without giving reasons or a hearing. The Court held that the right to travel abroad is part of personal liberty under Article 21, and that Articles 14, 19 and 21 are not mutually exclusive. Any law depriving a person of personal liberty must prescribe a procedure that is fair, just and reasonable, not merely formally enacted.',
    keyHoldings: [
      'Articles 14, 19 and 21 must be read together; they are not watertight compartments.',
      'Procedure established by law under Article 21 must be fair, just and reasonable.',
      'Principles of natural justice can be implied where a statute is silent.',
    ],
    tags: ['article 21', 'personal liberty', 'passport', 'due process', 'natural justice'],
    status: 'PUBLISHED',
    withDocument: true,
  },
  {
    title: 'Vishaka v. State of Rajasthan',
    caseNumber: 'Writ Petition (Criminal) 666-70 of 1992',
    citation: '(1997) 6 SCC 241; AIR 1997 SC 3011',
    court: 'Supreme Court of India',
    year: 1997,
    category: 'Human Rights',
    petitioner: 'Vishaka and others',
    respondent: 'State of Rajasthan and others',
    bench: 'J.S. Verma, C.J., Sujata V. Manohar and B.N. Kirpal, JJ.',
    decisionDate: '1997-08-13',
    summary:
      'Filed after the gang rape of a social worker in Rajasthan, the petition sought enforceable guidelines against sexual harassment at the workplace. In the absence of legislation, the Court laid down binding guidelines, drawing on Articles 14, 15, 19(1)(g) and 21 and on international conventions such as CEDAW. The guidelines operated until Parliament enacted the Sexual Harassment of Women at Workplace Act, 2013.',
    keyHoldings: [
      'Sexual harassment at work violates the fundamental rights to equality and to life and liberty.',
      'International conventions may be read into domestic law to fill a legislative vacuum.',
      'Employers must prevent harassment and set up complaint mechanisms (the Vishaka Guidelines).',
    ],
    tags: ['sexual harassment', 'workplace', 'CEDAW', 'vishaka guidelines', 'gender equality'],
    status: 'PUBLISHED',
    withDocument: true,
  },
  {
    title: 'Justice K.S. Puttaswamy (Retd.) v. Union of India',
    caseNumber: 'Writ Petition (Civil) 494 of 2012',
    citation: '(2017) 10 SCC 1',
    court: 'Supreme Court of India',
    year: 2017,
    category: 'Constitutional Law',
    petitioner: 'Justice K.S. Puttaswamy (Retd.) and another',
    respondent: 'Union of India and others',
    bench: 'Nine-judge Constitution Bench headed by J.S. Khehar, C.J.',
    decisionDate: '2017-08-24',
    summary:
      'Arising from a challenge to the Aadhaar scheme, a nine-judge Bench unanimously held that the right to privacy is a fundamental right, intrinsic to life and personal liberty under Article 21 and to the freedoms guaranteed by Part III. The Court overruled the contrary observations in M.P. Sharma and Kharak Singh, and recognised informational privacy, bodily integrity and autonomy as facets of privacy.',
    keyHoldings: [
      'The right to privacy is a fundamental right protected under Article 21 and Part III.',
      'Earlier decisions denying the right (M.P. Sharma; Kharak Singh) were overruled to that extent.',
      'Any intrusion must satisfy legality, a legitimate aim and proportionality.',
    ],
    tags: ['right to privacy', 'article 21', 'aadhaar', 'proportionality', 'informational privacy'],
    status: 'PUBLISHED',
    withDocument: true,
  },
  {
    title: 'Shreya Singhal v. Union of India',
    caseNumber: 'Writ Petition (Criminal) 167 of 2012',
    citation: '(2015) 5 SCC 1; AIR 2015 SC 1523',
    court: 'Supreme Court of India',
    year: 2015,
    category: 'Constitutional Law',
    petitioner: 'Shreya Singhal',
    respondent: 'Union of India',
    bench: 'J. Chelameswar and R.F. Nariman, JJ.',
    decisionDate: '2015-03-24',
    summary:
      'The petitioners challenged provisions of the Information Technology Act, 2000 that criminalised online speech. The Court struck down Section 66A as violating Article 19(1)(a) and not saved by Article 19(2), for vagueness and chilling effect. It read down Section 79 and the related intermediary rules so that takedown requires a court order or government notification, and upheld Section 69A with its safeguards.',
    keyHoldings: [
      'Section 66A of the IT Act is unconstitutional: vague, overbroad, and not a reasonable restriction.',
      'Discussion, advocacy and incitement are distinct; only incitement can be restricted.',
      'Intermediary takedown obligations arise only on a court order or government notification.',
    ],
    tags: ['free speech', 'article 19(1)(a)', 'section 66A', 'IT Act', 'intermediaries'],
    status: 'PUBLISHED',
    withDocument: true,
  },
  {
    title: 'M.C. Mehta v. Union of India (Oleum Gas Leak Case)',
    caseNumber: 'Writ Petition (Civil) 12739 of 1985',
    citation: '(1987) 1 SCC 395; AIR 1987 SC 1086',
    court: 'Supreme Court of India',
    year: 1986,
    category: 'Environmental Law',
    petitioner: 'M.C. Mehta',
    respondent: 'Union of India and others',
    bench: 'P.N. Bhagwati, C.J. and others',
    decisionDate: '1986-12-20',
    summary:
      'Following an oleum gas leak from a fertiliser plant in Delhi, the Court considered the liability of enterprises engaged in hazardous activity. It departed from the English rule in Rylands v. Fletcher and evolved the principle of absolute liability: such an enterprise must compensate those harmed, without the exceptions available under strict liability, and compensation should relate to the enterprise\'s size and capacity to pay.',
    keyHoldings: [
      'Enterprises carrying on hazardous or inherently dangerous activity owe an absolute and non-delegable duty to the community.',
      'The rule of absolute liability admits none of the exceptions of Rylands v. Fletcher.',
      'Compensation should be proportionate to the magnitude and capacity of the enterprise.',
    ],
    tags: ['absolute liability', 'hazardous industry', 'environment', 'article 32', 'compensation'],
    status: 'PUBLISHED',
    withDocument: false,
  },
  {
    title: 'Navtej Singh Johar v. Union of India',
    caseNumber: 'Writ Petition (Criminal) 76 of 2016',
    citation: '(2018) 10 SCC 1',
    court: 'Supreme Court of India',
    year: 2018,
    category: 'Human Rights',
    petitioner: 'Navtej Singh Johar and others',
    respondent: 'Union of India',
    bench: 'Five-judge Constitution Bench headed by Dipak Misra, C.J.',
    decisionDate: '2018-09-06',
    summary:
      'A Constitution Bench held that Section 377 of the Indian Penal Code, insofar as it criminalised consensual sexual conduct between adults of the same sex, was unconstitutional. The Court relied on the rights to equality, dignity, privacy and expression, and on the idea of transformative constitutionalism. The earlier decision in Suresh Kumar Koushal was overruled. (Seeded as PENDING to demonstrate the approval workflow.)',
    keyHoldings: [
      'Section 377 IPC is unconstitutional to the extent it criminalises consensual same-sex conduct between adults.',
      'Constitutional morality prevails over popular or social morality.',
      'Suresh Kumar Koushal v. Naz Foundation was overruled.',
    ],
    tags: ['section 377', 'LGBTQ rights', 'dignity', 'transformative constitutionalism'],
    status: 'PENDING',
    withDocument: false,
  },
];
