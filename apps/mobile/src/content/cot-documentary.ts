export type CotDocumentarySection = { title: string; paragraphs: string[] };
export type CotDocumentaryChapter = { title: string; paragraphs: string[]; sections: CotDocumentarySection[] };

export const COT_DOCUMENTARY = {
  "title": "COT — The Vision, the Platform, and the People Behind It",
  "subtitle": "Product Story, Purpose, Use Cases & Builder Documentation",
  "intro": [
    "COT is the digital platform of City of Transformation: a connected environment designed to bring church life, community, discipleship, communication, ministry operations, media, and administration into one coherent experience. This document explains the vision behind COT, the kind of problem it is designed to solve, where it fits in the wider life of the church, the people it serves, the practical situations in which it can be used, and the people recognized in its building journey."
  ],
  "chapters": [
    {
      "title": "1. The idea behind COT",
      "sections": [],
      "paragraphs": [
        "Church life is larger than a Sunday service. People discover a church, attend services, join communities, receive teaching, pray, serve, give, register for events, speak with leaders, participate in groups, watch live programmes, read Scripture, follow devotionals, and continue relationships throughout the week. Yet these activities are often scattered across many unrelated tools.",
        "A church may have one platform for livestreaming, another for messaging, another for forms, another for giving, a website for public information, social media for updates, separate chat groups for departments, and manual processes for roles, prayer, events, volunteers, or follow-up. Members must learn several systems while ministry teams repeatedly copy information from one place to another.",
        "COT is built around a different idea: the digital church experience should feel like one connected environment. A member should not need to understand the technology behind the church in order to participate in church life. Ministry teams should be able to operate within their assigned responsibilities. Platform administrators should be able to keep the digital environment healthy without becoming ministry content managers."
      ]
    },
    {
      "title": "2. The vision",
      "sections": [
        {
          "title": "The long-term direction",
          "paragraphs": [
            "COT is being built as more than a single-purpose church app. Its direction is toward a church digital operating environment: one platform in which public discovery, membership, community spaces, media, discipleship, communication, ministry workflows, live experiences, administration, and intelligent guidance can work together while remaining properly separated by role and scope.",
            "The goal is not to force every ministry into one identical workflow. COT is designed around scoped spaces, configurable tools, and permission boundaries so that a church-wide activity, an Expression activity, a Group activity, and a private member interaction can coexist without becoming the same thing."
          ]
        }
      ],
      "paragraphs": [
        "The vision of COT is to create a digital home for church life that continues beyond the physical building and beyond the time of a service. It is intended to make the church more reachable, more connected, more organized, and more usable without replacing physical fellowship, pastoral leadership, or human relationships.",
        "COT is not designed to make the church feel like a technology company. Technology should stay in the background. The visible experience should feel like church: people, Scripture, prayer, teaching, community, service, communication, worship, leadership, and participation.",
        "The platform therefore combines two goals that are often separated. The first is a warm member experience: a person should be able to open COT and quickly understand what is happening, what is available, where they belong, and what they can do next. The second is an organized operating environment: leaders and administrators should have the tools required to publish, coordinate, govern, and support that experience responsibly."
      ]
    },
    {
      "title": "3. What COT is",
      "sections": [
        {
          "title": "COT is not only a church social network",
          "paragraphs": [
            "COT includes feeds, posts, reactions, comments, sharing, reels, messages, groups, and calls, but social interaction is only one part of the platform. The product also contains Scripture and devotional experiences, sermons, live ministry, events, forms, prayer workflows, notifications, giving, leadership information, ministry workspaces, role management, and platform administration."
          ]
        },
        {
          "title": "COT is not only a church management system",
          "paragraphs": [
            "Traditional church management software often focuses on records, attendance, finance, or administration. COT includes operational capabilities, but the member-facing experience is equally important. The product is designed to be lived in by members, not only managed by staff."
          ]
        },
        {
          "title": "COT is not only a livestreaming or media app",
          "paragraphs": [
            "Live video, sermons, reels, recordings, books, and devotional content are important parts of COT, but they sit inside a larger relationship model. A person can watch, respond, join a community, ask for prayer, receive an announcement, enter a Group, complete a form, read Scripture, or continue a conversation after the media experience ends."
          ]
        }
      ],
      "paragraphs": [
        "COT can be understood as a church community platform, ministry operating system, content and discipleship environment, communication layer, and administrative platform working together.",
        "For the public, it can be an entry point into the church. For a signed-in member, it becomes a personal and community experience. For a ministry role bearer, it becomes a workspace for the responsibilities assigned to that person. For a Platform Administrator, it becomes a separate governance and infrastructure environment."
      ]
    },
    {
      "title": "4. Where COT fits in church life",
      "sections": [
        {
          "title": "Before someone joins",
          "paragraphs": [
            "Public COT can present church information and selected public content without requiring a person to join an internal community. Visitors can discover the church, learn its story, see public leadership information, view public media, follow selected events or livestreams, and understand what the church offers."
          ]
        },
        {
          "title": "After someone becomes a member",
          "paragraphs": [
            "Authentication adds participation rights. A member can move from simply viewing public information to interacting with community content, joining Expressions and Groups where eligible, messaging other members, using member tools, receiving notifications, reading and studying Scripture, following devotionals, registering for activities, and participating in the church's ongoing digital life."
          ]
        },
        {
          "title": "When someone carries ministry responsibility",
          "paragraphs": [
            "The same COT app can expose ministry tools appropriate to the person's assigned role. A ministry worker does not need a completely different member identity simply because they also help run part of the church. Their normal member experience remains, while authorized workspaces become available for the responsibilities they have been given."
          ]
        },
        {
          "title": "When someone manages the digital platform",
          "paragraphs": [
            "Platform Administration is intentionally separate. Platform Administrators govern the digital environment, access, infrastructure, service providers, feature availability, safety controls, and audit activity. They are not automatically church ministry publishers. This separation prevents technical authority from silently becoming pastoral or ministry authority."
          ]
        }
      ],
      "paragraphs": [
        "COT sits between the public face of the church and the internal life of the church. It can help a visitor discover the church before joining, then continue serving the same person as they become a member, join an Expression, participate in Groups, receive ministry communication, and take on responsibility.",
        "This continuity is important. A person should not have to leave one digital world and enter a completely unrelated system simply because their relationship with the church becomes deeper."
      ]
    },
    {
      "title": "5. The COT experience model",
      "sections": [
        {
          "title": "General COT",
          "paragraphs": [
            "General COT is the main church-wide environment. It can carry the public and member-facing Home experience, church announcements, official updates, sermons, events, Bible and devotional experiences, general prayer workflows, giving, Groups, messages, notifications, leadership information, and other church-wide resources.",
            "General COT should answer a simple question for a member: “What is happening in my church, and what can I do from here?”"
          ]
        },
        {
          "title": "Expressions",
          "paragraphs": [
            "An Expression is a distinct community space inside COT. It can represent a branch, fellowship, ministry community, campus, demographic community, or another church-defined expression of the wider church. A person enters an Expression before seeing its internal community life.",
            "An Expression can have its own Home, Feed, leadership, members, discussion, prayer, events, sermons, live experiences, Groups, giving context, announcements, and operations. Content inside an Expression remains scoped to that Expression unless a workflow deliberately publishes something more broadly."
          ]
        },
        {
          "title": "Groups",
          "paragraphs": [
            "Groups create smaller communities within General COT or an Expression. They can support departments, teams, fellowships, projects, classes, interest communities, service teams, or temporary activities. Depending on configuration, Groups can be public, private, or approval-based and can have their own chat and management controls."
          ]
        },
        {
          "title": "Direct relationships",
          "paragraphs": [
            "Direct Messages support person-to-person conversation inside COT. Messaging can include modern communication features such as replies, media, voice notes, and calls where enabled. Direct communication remains distinct from public feeds, ministry publishing, and platform administration."
          ]
        },
        {
          "title": "Ministry Tools",
          "paragraphs": [
            "Ministry Tools are role-aware workspaces inside the church app. They allow authorized people to create and manage the content or workflows for which they are responsible, such as announcements, events, sermons, Bible and daily content, devotionals, forms, Home banners, Groups, prayer workflows, giving operations, leadership information, and other scoped responsibilities."
          ]
        },
        {
          "title": "Platform Administration",
          "paragraphs": [
            "Platform Administration is the separate web environment used for digital governance. It covers areas such as organisations, Expressions, accounts and access, moderation, platform roles, administrator invitations, feature availability, provider credentials, streaming infrastructure, AI infrastructure, payment infrastructure, system activity, and audit/security."
          ]
        }
      ],
      "paragraphs": [
        "COT is organized in layers so that church-wide life and smaller communities can coexist without losing their identity."
      ]
    },
    {
      "title": "6. Who COT is for",
      "sections": [
        {
          "title": "Visitors and seekers",
          "paragraphs": [
            "COT can help someone encounter City of Transformation digitally before they are ready to become an active member. Public content can introduce the church without exposing internal community information."
          ]
        },
        {
          "title": "Members",
          "paragraphs": [
            "Members use COT as a day-to-day church companion. They can discover what is happening, interact with community content, communicate with others, read Scripture, follow devotionals, watch or listen to ministry content, join eligible communities, respond to events and forms, receive notices, and use the tools available to them."
          ]
        },
        {
          "title": "Ministry workers and leaders",
          "paragraphs": [
            "Ministry roles use COT both as members and as operators. Their workspaces are based on responsibility rather than title alone. A person receives the tools connected to the authority they actually hold, helping the church distribute work without giving everyone unrestricted access."
          ]
        },
        {
          "title": "Pastoral and care teams",
          "paragraphs": [
            "COT can support scoped prayer, testimony, follow-up, and care workflows while preserving privacy boundaries. Pastoral responsibility is not treated as ordinary social moderation, and sensitive information should remain inside the protected workflow that collected it."
          ]
        },
        {
          "title": "Media and communications teams",
          "paragraphs": [
            "Media and communications teams can use the platform to publish official content, manage sermons and visual assets, prepare announcements and Home banners, support live experiences, distribute ministry media, and keep church-wide communication coherent."
          ]
        },
        {
          "title": "Administrative and finance roles",
          "paragraphs": [
            "Authorized roles can operate event, attendance, giving, finance, membership, role, Group, and reporting workflows where those capabilities are assigned. The purpose is to make operational responsibility visible and scoped rather than informal and hidden."
          ]
        },
        {
          "title": "Platform Administrators",
          "paragraphs": [
            "Platform Administrators maintain the digital environment itself. Their job is to keep COT safe, available, correctly configured, and auditable while respecting the boundary between platform authority and ministry authority."
          ]
        }
      ],
      "paragraphs": []
    },
    {
      "title": "7. Core use cases",
      "sections": [
        {
          "title": "Church discovery and public presence",
          "paragraphs": [
            "COT can serve as a digital front door. A person may discover the church, understand its story and leadership, see selected events, follow public content, or watch a public livestream. This creates continuity between public presence and eventual participation."
          ]
        },
        {
          "title": "Church-wide communication",
          "paragraphs": [
            "Official announcements, urgent updates, Home spotlight banners, notifications, and linked forms can be used together to communicate important information. A member can move from seeing an update to taking the intended action without searching through several disconnected channels."
          ]
        },
        {
          "title": "Events and registration",
          "paragraphs": [
            "A ministry team can create an event, publish its details, add artwork, connect a configurable form when more information is needed, promote the event through Home or an announcement, and allow members to respond from the same environment."
          ]
        },
        {
          "title": "Bible engagement and daily discipleship",
          "paragraphs": [
            "COT includes a Bible experience for reading, search, study, notes, bookmarks, highlights, history, reading plans, and daily Scripture. Daily Bible, Daily Quote, and Daily Devotional can form a repeating discipleship rhythm on Home while still opening into dedicated reading experiences."
          ]
        },
        {
          "title": "Sermons, books, and long-form teaching",
          "paragraphs": [
            "Members can access sermons and written ministry resources inside the same platform. Written sermon notes and supported books can be read progressively, copied where appropriate, studied, or read aloud. Ministry can publish and organize these resources without turning the member experience into a file repository."
          ]
        },
        {
          "title": "Prayer and testimony",
          "paragraphs": [
            "Prayer requests and testimony workflows can be scoped to General COT or an Expression according to the design of the workflow. The platform can help route requests to the people who are meant to receive them while avoiding the assumption that all prayer information should be publicly visible."
          ]
        },
        {
          "title": "Community feeds and participation",
          "paragraphs": [
            "Members can participate in posts, comments, reactions, reels, polls, and community discussion where enabled. The aim is not engagement for its own sake; community features should help people remain connected to church life and to one another."
          ]
        },
        {
          "title": "Groups and ministry teams",
          "paragraphs": [
            "A department, fellowship, class, service team, project team, or temporary community can use a Group rather than creating an external chat space that is disconnected from COT identity and permissions. Group membership, chat, calls, announcements, and other enabled tools remain connected to the wider church environment."
          ]
        },
        {
          "title": "Messaging and calls",
          "paragraphs": [
            "Direct, Group, and eligible community communication can include audio and video calls. In-app call notices, supported browser notifications, call controls, and call-history events allow communication to feel like part of the conversation rather than a completely separate application."
          ]
        },
        {
          "title": "Live church experiences",
          "paragraphs": [
            "COT can support church-wide and Expression-level live experiences while keeping provider infrastructure behind the scenes. Members interact with the church experience; administrators manage the technical service path separately."
          ]
        },
        {
          "title": "Giving and financial workflows",
          "paragraphs": [
            "COT can present giving opportunities and support finance workflows according to the church's approved configuration. Ministry-facing giving purposes and member-facing giving should remain separate from platform provider configuration and infrastructure."
          ]
        },
        {
          "title": "Configurable forms",
          "paragraphs": [
            "Forms allow ministry teams to collect structured information for registrations, applications, feedback, volunteer interest, and other approved workflows without requiring a new hardcoded screen for every use case. Forms can be attached to events, announcements, or promoted through Home."
          ]
        },
        {
          "title": "Ministry visual communication",
          "paragraphs": [
            "Official ministry workspaces can support uploaded or AI-generated artwork for banners, events, announcements, sermons, forms, daily content, and other ministry surfaces. The visual is treated as supporting artwork while the actual title, Scripture, date, and call to action remain readable text inside COT."
          ]
        },
        {
          "title": "Digital guidance and support",
          "paragraphs": [
            "COT AI can answer verified questions about the church and guide people through the product. The integrated operating guides allow members and authorized role bearers to ask how a screen or workflow works and receive a role-aware explanation rather than searching a long manual."
          ]
        }
      ],
      "paragraphs": []
    },
    {
      "title": "8. Example real-world journeys",
      "sections": [
        {
          "title": "A first-time visitor",
          "paragraphs": [
            "A visitor opens COT and explores public church information. They watch a public message, view an upcoming event, learn about the church, and later decide to create an account. Once authenticated and connected to the church, the same product becomes their member environment rather than sending them to an unrelated system."
          ]
        },
        {
          "title": "A member beginning the day",
          "paragraphs": [
            "A member opens Home and sees the day's Scripture, Daily Quote, and Daily Devotional. They open the Bible passage, bookmark it, read the reflection, listen to part of the devotional through Read aloud, and later receive a church announcement without leaving COT."
          ]
        },
        {
          "title": "A member registering for an event",
          "paragraphs": [
            "The member sees an official Home spotlight card, opens the event, reads the details, opens the attached registration form, submits the required information, and receives the form's confirmation. The entire journey happens inside one coherent flow."
          ]
        },
        {
          "title": "A ministry leader preparing an announcement",
          "paragraphs": [
            "An authorized ministry role opens Ministry Tools, prepares the announcement, optionally generates or uploads supporting artwork, attaches a published response form if action is required, chooses the correct audience and publication state, and verifies what a normal member will see before publishing."
          ]
        },
        {
          "title": "An Expression community",
          "paragraphs": [
            "A member enters an Expression and sees only that community's internal Home, Feed, events, discussion, prayer, leadership, Groups, sermons, live experiences, and other enabled tools. Another member outside the Expression does not automatically receive access to those internal surfaces."
          ]
        },
        {
          "title": "A Group team call",
          "paragraphs": [
            "A Group member opens the Group chat, sees that a call has started, joins the call if eligible, communicates with the team, leaves when finished, and can later see the call event in the same chat timeline. The Group does not need a separate identity system just to communicate."
          ]
        },
        {
          "title": "A Platform Administrator troubleshooting a service",
          "paragraphs": [
            "A Platform Administrator uses the separate administration website to inspect service readiness, feature availability, or system activity. They can use Ask COT Guide to understand the current page. They do not publish a church announcement from the platform console because ministry communication remains a ministry responsibility."
          ]
        }
      ],
      "paragraphs": []
    },
    {
      "title": "9. COT AI and the in-app guide",
      "sections": [],
      "paragraphs": [
        "COT AI is intended to make a large platform easier to understand. It is not simply a general chatbot placed inside the app. It can use verified COT context for church information and role-aware documentation for operational guidance.",
        "A normal member can ask how to use member features. A ministry-role user can ask about the ministry workflows available to that account. Platform Administrators can ask detailed questions from the administration environment. The server determines the permitted guide scope from the signed-in user's actual access rather than trusting the wording of the question.",
        "Read aloud allows long guidance to be listened to rather than only read. This is useful for accessibility, learning, onboarding, and situations where a user wants to follow instructions while operating another screen."
      ]
    },
    {
      "title": "10. Trust, privacy, and role boundaries",
      "sections": [],
      "paragraphs": [
        "A church platform handles relationships and information that deserve care. COT is therefore designed around scope and responsibility rather than the idea that every administrator should see everything.",
        "Public information, member information, ministry operations, private community content, prayer or pastoral information, financial information, and platform infrastructure do not all belong in the same visibility layer.",
        "The role model separates ordinary membership, ministry responsibility, Expression responsibility, Group responsibility, presentation titles or badges, and Platform Administration. A visible title does not silently create permission. Platform authority does not silently create ministry authority. Membership in one community does not automatically expose another community's internal content.",
        "This separation is not only a security feature. It is part of the product vision: people should know the context they are operating in, leaders should know the responsibility they hold, and the church should be able to distribute work without losing accountability."
      ]
    },
    {
      "title": "11. What makes COT different",
      "sections": [],
      "paragraphs": [
        "COT's value is not one isolated feature. Many individual features can be found in separate products. The differentiator is the way they are intended to work together around church identity, scope, and continuity.",
        "A Bible passage can lead into a daily reflection. An event can lead into a form. An announcement can lead into an internal action. A sermon can be read, listened to, studied, or shared. A community can have a feed, Group, call, event, prayer flow, or live experience. A ministry role can operate the same church environment members use while seeing only the tools assigned to that responsibility.",
        "The product is therefore less about accumulating features and more about reducing fragmentation."
      ]
    },
    {
      "title": "12. How COT can fit different church sizes",
      "sections": [
        {
          "title": "A growing local church",
          "paragraphs": [
            "A growing church can use General COT as the primary member environment, introduce Groups as ministries become larger, and add more structured roles gradually. The church does not need to activate every capability on day one."
          ]
        },
        {
          "title": "A multi-community or multi-branch church",
          "paragraphs": [
            "Expressions allow distinct communities to keep their own internal life while remaining connected to the larger church platform. This can support branches, fellowships, campuses, demographic communities, or other structures defined by the church."
          ]
        },
        {
          "title": "A church with many ministries",
          "paragraphs": [
            "Role-aware Ministry Tools allow work to be distributed across communications, media, Bible and devotionals, events, prayer, Groups, finance, leadership, or other functions without converting every worker into a global administrator."
          ]
        },
        {
          "title": "A digitally distributed church community",
          "paragraphs": [
            "Livestreaming, media, Groups, direct communication, Bible engagement, notifications, forms, and digital guidance help COT support members who may not always be physically present while keeping the online experience connected to actual church structure and leadership."
          ]
        }
      ],
      "paragraphs": []
    },
    {
      "title": "13. Product philosophy",
      "sections": [
        {
          "title": "Church first, technology second",
          "paragraphs": [
            "The product should explain itself in church language wherever possible. Users should not need to understand databases, providers, tokens, routing, APIs, or infrastructure to participate in church life."
          ]
        },
        {
          "title": "One identity, multiple responsibilities",
          "paragraphs": [
            "A person should remain the same person when moving from member participation to an authorized ministry workspace. Responsibility changes what tools are available; it should not fragment the person's identity into unrelated systems."
          ]
        },
        {
          "title": "Scope should be visible",
          "paragraphs": [
            "General COT, an Expression, a Group, a Direct Message, a Ministry workspace, and Platform Administration are different contexts. COT should make those boundaries understandable rather than silently mixing them."
          ]
        },
        {
          "title": "Configuration over hardcoding",
          "paragraphs": [
            "Where practical, church policy, feature availability, providers, visual identity, and operational settings should be configurable. This allows the platform to evolve without requiring code changes for every ministry decision."
          ]
        },
        {
          "title": "Human authority over automation",
          "paragraphs": [
            "AI, notifications, workflows, and automated services should support people rather than replace spiritual, pastoral, or governance responsibility. Important ministry decisions remain human decisions."
          ]
        }
      ],
      "paragraphs": []
    },
    {
      "title": "14. The Builder and Contributors",
      "sections": [
        {
          "title": "Builder",
          "paragraphs": [
            "Okonkwo Chiemerie Nathaniel",
            "Okonkwo Chiemerie Nathaniel is recognized in this documentation as the builder of COT. The product reflects a continuing effort to turn a broad church-digital vision into one connected platform: from the public experience and member community to Expressions, Groups, ministry operations, AI guidance, communication, media, and Platform Administration.",
            "The builder's role in this documentary is intentionally described at the product level. COT is presented as a living platform that has been shaped through repeated design, implementation, testing, correction, and expansion rather than as a single one-time software release."
          ]
        },
        {
          "title": "Contributors",
          "paragraphs": [
            "Nwa Chukwu Daniel",
            "Sister Divine",
            "Nwa Chukwu Daniel and Sister Divine are recognized as contributors to the COT project. This document does not assign specific contribution areas that have not been provided; those areas can be added later as the project history is expanded."
          ]
        }
      ],
      "paragraphs": []
    },
    {
      "title": "15. COT as a living project",
      "sections": [],
      "paragraphs": [
        "COT is not a static product description. The platform continues to evolve as real church workflows reveal what should be simplified, separated, connected, or improved. That includes changes to navigation, Home, feeds, calls, Groups, livestreaming, documentation, ministry tooling, Bible experiences, notifications, AI guidance, forms, visual communication, and administrative boundaries.",
        "This iterative character is important to the COT story. The product is being shaped around actual use rather than only around an initial diagram. When a workflow proves confusing or creates the wrong boundary, the goal is to improve the product while preserving the parts that already work."
      ]
    },
    {
      "title": "16. Future direction",
      "sections": [],
      "paragraphs": [
        "The future direction of COT is to become increasingly complete without becoming increasingly confusing. New capabilities should strengthen the existing model rather than create disconnected mini-apps inside the product.",
        "The strongest future version of COT is one in which a visitor can discover the church, a member can participate meaningfully, a leader can operate ministry responsibly, a community can have its own identity, a Platform Administrator can govern the technology safely, and each person can understand what to do without needing technical training.",
        "The long-term measure of success is therefore not the number of features in the application. It is whether COT makes church participation, connection, communication, discipleship, ministry work, and digital administration more coherent."
      ]
    },
    {
      "title": "17. Closing statement",
      "sections": [],
      "paragraphs": [
        "COT represents a vision of church technology that is integrated but not intrusive. It brings together public presence, member life, community, Scripture, media, prayer, events, communication, ministry responsibility, administration, and intelligent guidance while preserving the boundaries that make each area trustworthy.",
        "At its best, COT should feel less like a collection of software modules and more like a digital extension of an organized, living church community.",
        "That is the central idea behind the platform: one connected digital home for church life, built to help people belong, participate, grow, serve, communicate, and lead within the right context."
      ]
    }
  ],
  "builder": "Okonkwo Chiemerie Nathaniel",
  "contributors": [
    "Nwa Chukwu Daniel",
    "Sister Divine"
  ],
  "sourceDocumentId": "18TlsJUk3tdWpBEyxmKvLiIYs3CqxTYVoQpkfmCj0VFU"
} as const;

export const COT_DOCUMENTARY_SPEECH_TEXT = [
  COT_DOCUMENTARY.title,
  COT_DOCUMENTARY.subtitle,
  ...COT_DOCUMENTARY.intro,
  ...COT_DOCUMENTARY.chapters.flatMap((chapter) => [
    chapter.title,
    ...chapter.paragraphs,
    ...chapter.sections.flatMap((section) => [section.title, ...section.paragraphs]),
  ]),
].join('\n\n');
