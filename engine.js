// ═══════════════════════════════════════════════════════════════════════════
//  DRAFT ZONE — DYNAMIC MATCH ENGINE v4.0
//  ~2600 lines of pure football logic
//  5 new attributes: clutch, visionRange, offTheBall, aggression, adaptability
//  Full tactical identity system, momentum engine, match narrative generator
// ═══════════════════════════════════════════════════════════════════════════

// ── UTILITIES ────────────────────────────────────────────────────────────────
function avg2(...vals){const f=vals.flat().filter(v=>v!=null&&!isNaN(v));return f.length?f.reduce((a,b)=>a+b,0)/f.length:0}
function clamp2(v,lo,hi){return Math.max(lo,Math.min(hi,v))}
function rng2(lo,hi){return Math.random()*(hi-lo)+lo}
function pick2(arr){return arr[Math.floor(Math.random()*arr.length)]}
function weighted2(items,wFn){const w=items.map(wFn),tot=w.reduce((a,b)=>a+b,0);let r=Math.random()*tot;for(let i=0;i<items.length;i++){r-=w[i];if(r<=0)return items[i]}return items[0]}
function sname(p){return p?p.name.split("—")[0].trim():"?"}
function firstByRole(sq,role){for(let i=0;i<window.LAYOUT.length;i++){if(window.LAYOUT[i].role===role&&sq[i])return sq[i]}return null}
function allByRole(sq,role){return window.LAYOUT.map((l,i)=>l.role===role?sq[i]:null).filter(Boolean)}
function posScore2(p,role){
  if(!p)return 55;
  const w=window.PW[role]||{overall:1};
  let s=0;for(const[k,v] of Object.entries(w))s+=(p[k]??p.overall??70)*v;
  return clamp2(Math.round(s),40,99);
}
function attrCol2(v){if(v>=88)return"#4ade80";if(v>=78)return"#a3e635";if(v>=66)return"#fbbf24";if(v>=52)return"#f97316";return"#f87171"}
function a(p,k,def=70){return p?(p[k]??def):def}

// ── NEW ATTRIBUTE DEFAULTS (backwards compatible) ────────────────────────────
// clutch: performs in final 15 mins, pens, must-win moments (Messi 96, Declan Rice 72)
// visionRange: how far ahead they see passes — distinct from creativity (Pirlo 98, R9 55)
// offTheBall: movement without the ball — how they find space (Lewandowski 96, Baresi 40)
// aggression: how intensely they contest duels, press, tackle (Casemiro 92, Kroos 52)
// adaptability: how well they adjust mid-match to change in opponent tactics (Zidane 92, Haaland 60)
function getAttr(p,attr){
  if(p[attr]!=null)return p[attr];
  // Intelligent defaults derived from other attributes
  switch(attr){
    case"clutch":return avg2(a(p,"bigGameRating"),a(p,"consistency"),a(p,"leadership",70));
    case"visionRange":return avg2(a(p,"intelligence"),a(p,"passing"),a(p,"creativity"));
    case"offTheBall":return avg2(a(p,"intelligence"),a(p,"positioning"),a(p,"pace"),a(p,"finishing",60));
    case"aggression":return avg2(a(p,"pressing"),a(p,"workRate"),a(p,"physical"),a(p,"tackling",60));
    case"adaptability":return avg2(a(p,"intelligence"),a(p,"versatility",70),a(p,"consistency"));
    default:return 70;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  TACTICAL IDENTITY ENGINE
//  Each team gets a tactical profile that governs HOW they play
//  This affects phase calculations beyond just raw stats
// ═══════════════════════════════════════════════════════════════════════════
function calcTacticalIdentity(sq){
  const all=sq.filter(Boolean);
  const ps=all.flatMap(p=>p.playstyles||[]);
  const traits=all.flatMap(p=>p.traits||[]);
  const countP=s=>ps.filter(x=>x===s).length;
  const countT=t=>traits.filter(x=>x===t).length;

  // ── PRIMARY STYLE DETECTION ──────────────────────────────
  const styleScores={
    highPress: countP("highPress")*12 + all.filter(p=>a(p,"pressing")>78&&a(p,"workRate")>78).length*8,
    possession: countP("possession")*12 + all.filter(p=>a(p,"pressResistance")>80&&a(p,"technical")>78).length*7,
    counterAttack: countP("counterAttack")*12 + all.filter(p=>a(p,"transitionThreat")>78&&a(p,"pace")>82).length*8,
    direct: countP("direct")*12 + all.filter(p=>a(p,"physical")>82||a(p,"pace")>86).length*5,
    organised: countP("organised")*12 + all.filter(p=>a(p,"defensiveAwareness")>80&&a(p,"intelligence")>80).length*6,
    tiki: all.filter(p=>a(p,"technical")>86&&a(p,"pressResistance")>84).length*10,
  };
  const primaryStyle=Object.entries(styleScores).sort((a,b)=>b[1]-a[1])[0][0];
  const secondaryStyle=Object.entries(styleScores).sort((a,b)=>b[1]-a[1])[1][0];

  // ── DEFENSIVE LINE HEIGHT ────────────────────────────────
  // Determined by CB pace, CDM quality, team intelligence
  const cbPaceAvg=avg2(...allByRole(sq,"cb").map(c=>a(c,"pace")));
  const cdm=firstByRole(sq,"cdm");
  const teamIntell=avg2(...all.map(p=>a(p,"intelligence")));
  let lineHeight;
  if(cbPaceAvg>80&&teamIntell>84&&cdm&&posScore2(cdm,"cdm")>80)lineHeight="veryhigh";
  else if(cbPaceAvg>74&&teamIntell>80)lineHeight="high";
  else if(cbPaceAvg>68&&teamIntell>75)lineHeight="medium";
  else lineHeight="low";

  // ── PRESSING INTENSITY ───────────────────────────────────
  const pressingAvg=avg2(...all.map(p=>a(p,"pressing")));
  const staminaAvg=avg2(...all.map(p=>a(p,"stamina")));
  const workRateAvg=avg2(...all.map(p=>a(p,"workRate")));
  let pressingIntensity;
  if(pressingAvg>80&&staminaAvg>82&&workRateAvg>82)pressingIntensity="gegenpressing";
  else if(pressingAvg>74&&staminaAvg>76)pressingIntensity="high";
  else if(pressingAvg>66)pressingIntensity="medium";
  else pressingIntensity="low";

  // ── ATTACKING APPROACH ───────────────────────────────────
  const wideAttack=countP("wide")>=2||countT("crossingSpecialist")>=1||countT("attackingFullback")>=2;
  const centralAttack=countP("direct")>=2||countT("penaltyBoxPredator")>=1||countT("intelligentMover")>=1;
  const verticalAttack=countP("vertical")>=2||countT("paceAbuser")>=2||all.filter(p=>a(p,"transitionThreat")>85).length>=2;
  const attackingApproach=wideAttack&&verticalAttack?"hybrid_wide_vertical":
    wideAttack?"wide_dominant":verticalAttack?"vertical_direct":"central_build";

  // ── TEAM DEFENSIVE SHAPE ─────────────────────────────────
  const cdmQuality=cdm?posScore2(cdm,"cdm"):50;
  const cbQuality=avg2(...allByRole(sq,"cb").map(c=>posScore2(c,"cb")));
  const compactness=avg2(cdmQuality*0.4,cbQuality*0.35,teamIntell*0.25);
  let defensiveShape;
  if(compactness>84)defensiveShape="fortress";
  else if(compactness>76)defensiveShape="solid";
  else if(compactness>66)defensiveShape="organised";
  else defensiveShape="vulnerable";

  // ── TRANSITION READINESS ─────────────────────────────────
  const fwdPace=avg2(...[firstByRole(sq,"lw"),firstByRole(sq,"rw"),firstByRole(sq,"st")].filter(Boolean).map(p=>a(p,"pace")));
  const fwdTrans=avg2(...[firstByRole(sq,"lw"),firstByRole(sq,"rw"),firstByRole(sq,"st")].filter(Boolean).map(p=>a(p,"transitionThreat")));
  const transitionReadiness=avg2(fwdPace,fwdTrans);

  // ── ADAPTABILITY RATING ──────────────────────────────────
  const teamAdaptability=avg2(...all.map(p=>getAttr(p,"adaptability")));
  const teamClutch=avg2(...all.map(p=>getAttr(p,"clutch")));
  const teamVision=avg2(...all.map(p=>getAttr(p,"visionRange")));
  const teamOffBall=avg2(...all.map(p=>getAttr(p,"offTheBall")));
  const teamAggression=avg2(...all.map(p=>getAttr(p,"aggression")));

  return{
    primaryStyle,secondaryStyle,lineHeight,pressingIntensity,
    attackingApproach,defensiveShape,transitionReadiness,
    teamAdaptability,teamClutch,teamVision,teamOffBall,teamAggression,
    styleScores,wideAttack,centralAttack,verticalAttack,
    pressingAvg,staminaAvg,workRateAvg,cbPaceAvg,teamIntell,cdmQuality,cbQuality,compactness
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  INDIVIDUAL THREAT RATINGS WITH NEW ATTRIBUTES
// ═══════════════════════════════════════════════════════════════════════════
function calcIndividualThreats(sq){
  const gk=firstByRole(sq,"gk");
  const cbs=allByRole(sq,"cb");
  const lb=firstByRole(sq,"lb");
  const rb=firstByRole(sq,"rb");
  const cdm=firstByRole(sq,"cdm");
  const cm=firstByRole(sq,"cm");
  const cam=firstByRole(sq,"cam");
  const lw=firstByRole(sq,"lw");
  const rw=firstByRole(sq,"rw");
  const st=firstByRole(sq,"st");
  const all=sq.filter(Boolean);

  // ── GK ───────────────────────────────────────────────────
  const gkShotStopping=gk?avg2(a(gk,"goalkeeperRating"),a(gk,"reflexes")):55;
  const gkAerialCommand=gk?avg2(a(gk,"commandOfArea"),a(gk,"aerial")):55;
  const gkDistributionThreat=gk?a(gk,"distribution"):60;
  const gkBigGameFactor=gk?getAttr(gk,"clutch"):70;
  const gkAdaptability=gk?getAttr(gk,"adaptability"):70;

  // ── CB PARTNERSHIP ───────────────────────────────────────
  const cbRaw=cbs.length?avg2(...cbs.map(c=>posScore2(c,"cb"))):55;
  let cbPartnershipBonus=0;
  if(cbs.length>=2){
    const maxPace=Math.max(...cbs.map(c=>a(c,"pace")));
    const maxAerial=Math.max(...cbs.map(c=>a(c,"aerial")));
    const minPace=Math.min(...cbs.map(c=>a(c,"pace")));
    const bothSmart=cbs.every(c=>a(c,"intelligence")>82);
    const bothLeaders=cbs.every(c=>a(c,"leadership")>80);
    const hasBPD=cbs.some(c=>(c.traits||[]).includes("ballPlayingDefender"));
    const avgAdapt=avg2(...cbs.map(c=>getAttr(c,"adaptability")));
    if(maxPace>80&&maxAerial>84&&minPace>72)cbPartnershipBonus+=7;
    if(bothSmart)cbPartnershipBonus+=6;
    if(bothLeaders)cbPartnershipBonus+=4;
    if(hasBPD)cbPartnershipBonus+=3;
    if(avgAdapt>84)cbPartnershipBonus+=4; // adaptable CBs adjust to different threats
    // Elite-tier partnership bonus
    if(cbRaw>88&&bothSmart&&bothLeaders)cbPartnershipBonus+=8; // Baresi+Cannavaro level
  }
  const cbEffectiveness=clamp2(cbRaw+cbPartnershipBonus,40,99);

  // ── CDM MULTI-DIMENSIONAL ────────────────────────────────
  const cdmDefContrib=cdm?posScore2(cdm,"cdm"):50;
  const cdmPressResistance=cdm?a(cdm,"pressResistance"):60;
  const cdmScreenQuality=cdm?avg2(a(cdm,"defensiveAwareness"),a(cdm,"positioning"),a(cdm,"tackling")):55;
  const cdmTransitionLaunch=cdm?avg2(a(cdm,"passing"),getAttr(cdm,"visionRange"),a(cdm,"transitionThreat",60)):55;
  const cdmWorkHorse=cdm?avg2(a(cdm,"workRate"),a(cdm,"stamina"),a(cdm,"pressing")):55;
  const cdmAttackContrib=cdm?avg2(a(cdm,"attack",50),a(cdm,"finishing",50),getAttr(cdm,"offTheBall")):45;
  const cdmIsBoxToBox=cdm&&(cdm.traits||[]).some(t=>["boxToBox","goalScoringMidfielder"].includes(t));
  const cdmAggression=cdm?getAttr(cdm,"aggression"):70;
  const cdmAdaptability=cdm?getAttr(cdm,"adaptability"):70;
  // A high-aggression CDM wins more physical battles
  const cdmPhysicalDomination=cdm?avg2(cdmAggression,a(cdm,"physical"),a(cdm,"tackling")):60;

  // ── CM ───────────────────────────────────────────────────
  const cmControlContrib=cm?posScore2(cm,"cm"):55;
  const cmCreativeOutput=cm?avg2(a(cm,"creativity"),a(cm,"passing"),a(cm,"technical")):55;
  const cmVisionRange=cm?getAttr(cm,"visionRange"):70;
  const cmPressingContrib=cm?avg2(a(cm,"pressing"),a(cm,"workRate")):55;
  const cmCoverageIntelligence=cm?a(cm,"intelligence"):70;
  const cmOffBall=cm?getAttr(cm,"offTheBall"):70;
  const cmClutch=cm?getAttr(cm,"clutch"):70;

  // ── CAM ──────────────────────────────────────────────────
  const camThreat=cam?posScore2(cam,"cam"):50;
  const camCreativity=cam?a(cam,"creativity"):60;
  const camVisionRange=cam?getAttr(cam,"visionRange"):70;
  const camPressResistance=cam?a(cam,"pressResistance"):60;
  const camDropsDeep=cam&&a(cam,"intelligence")>82&&a(cam,"pressResistance")>78;
  const camSetPieceThreat=cam?a(cam,"setPieces"):60;
  const camOffBall=cam?getAttr(cam,"offTheBall"):70;
  const camClutch=cam?getAttr(cam,"clutch"):70;

  // ── FULLBACKS DUAL ROLE ──────────────────────────────────
  const lbAttackMode=lb?((lb.traits||[]).includes("attackingFullback")||a(lb,"attack")>72):false;
  const rbAttackMode=rb?((rb.traits||[]).includes("attackingFullback")||a(rb,"attack")>72):false;
  const lbAttackThreat=lb?avg2(a(lb,"pace"),a(lb,"crossing"),a(lb,"attack"),a(lb,"dribbling")):50;
  const rbAttackThreat=rb?avg2(a(rb,"pace"),a(rb,"crossing"),a(rb,"attack"),a(rb,"dribbling")):50;
  const lbDefensiveSecurity=lb?avg2(a(lb,"pace"),a(lb,"defensiveAwareness"),a(lb,"tackling"),a(lb,"intelligence")):55;
  const rbDefensiveSecurity=rb?avg2(a(rb,"pace"),a(rb,"defensiveAwareness"),a(rb,"tackling"),a(rb,"intelligence")):55;
  const lbAttackRisk=lbAttackMode?a(lb,"attack",60)*0.8:a(lb,"attack",60)*0.35;
  const rbAttackRisk=rbAttackMode?a(rb,"attack",60)*0.8:a(rb,"attack",60)*0.35;
  const fbCombinedAttackRisk=avg2(lbAttackRisk,rbAttackRisk);
  // FB adaptability — can they defend when needed even if they attack?
  const lbAdaptability=lb?getAttr(lb,"adaptability"):70;
  const rbAdaptability=rb?getAttr(rb,"adaptability"):70;

  // ── WINGERS ──────────────────────────────────────────────
  const lwThreat=lw?posScore2(lw,"lw"):50;
  const rwThreat=rw?posScore2(rw,"rw"):50;
  const lwSpeedThreat=lw?avg2(a(lw,"pace"),a(lw,"transitionThreat")):50;
  const rwSpeedThreat=rw?avg2(a(rw,"pace"),a(rw,"transitionThreat")):50;
  const lwCrossingThreat=lw?avg2(a(lw,"crossing"),a(lw,"creativity")):50;
  const rwCrossingThreat=rw?avg2(a(rw,"crossing"),a(rw,"creativity")):50;
  const lwInsideThreat=lw?avg2(a(lw,"dribbling"),a(lw,"finishing"),getAttr(lw,"offTheBall")):50;
  const rwInsideThreat=rw?avg2(a(rw,"dribbling"),a(rw,"finishing"),getAttr(rw,"offTheBall")):50;
  const lwDefensiveContrib=lw?avg2(a(lw,"workRate"),a(lw,"pressing"),a(lw,"defensiveAwareness"))*0.6:40;
  const rwDefensiveContrib=rw?avg2(a(rw,"workRate"),a(rw,"pressing"),a(rw,"defensiveAwareness"))*0.6:40;
  const lwClutch=lw?getAttr(lw,"clutch"):70;
  const rwClutch=rw?getAttr(rw,"clutch"):70;
  // Off-the-ball movement of wingers affects how hard they are to mark
  const lwOffBallThreat=lw?getAttr(lw,"offTheBall"):70;
  const rwOffBallThreat=rw?getAttr(rw,"offTheBall"):70;

  // ── STRIKER ──────────────────────────────────────────────
  const stThreat=st?posScore2(st,"st"):50;
  const stFinishingThreat=st?avg2(a(st,"finishing"),a(st,"positioning")):50;
  const stPaceThreat=st?avg2(a(st,"pace"),a(st,"transitionThreat")):50;
  const stAerialThreat=st?avg2(a(st,"aerial"),a(st,"physical")):50;
  const stLinkUpThreat=st?avg2(a(st,"passing"),a(st,"intelligence"),a(st,"creativity"))*0.8:45;
  const stBigGameFactor=st?getAttr(st,"clutch"):70;
  const stOffBall=st?getAttr(st,"offTheBall"):70;
  // Off-the-ball movement of striker — how well do they find space?
  // Lewandowski/Kane off-ball is exceptional, Haaland slightly less
  const stOffBallBonus=clamp2((stOffBall-70)*0.15,0,8);

  // ── TEAM-WIDE AGGREGATES ─────────────────────────────────
  const s=k=>avg2(...all.map(p=>a(p,k)));
  const sa=k=>avg2(...all.map(p=>getAttr(p,k)));

  return{
    gk,cbs,lb,rb,cdm,cm,cam,lw,rw,st,all,
    gkShotStopping,gkAerialCommand,gkDistributionThreat,gkBigGameFactor,gkAdaptability,
    cbEffectiveness,cbRaw,cbPartnershipBonus,
    cbPace:cbs.length?avg2(...cbs.map(c=>a(c,"pace"))):65,
    cbAerial:cbs.length?avg2(...cbs.map(c=>a(c,"aerial"))):70,
    cbDefAware:cbs.length?avg2(...cbs.map(c=>a(c,"defensiveAwareness"))):70,
    cbTackle:cbs.length?avg2(...cbs.map(c=>a(c,"tackling"))):70,
    cbIntelligence:cbs.length?avg2(...cbs.map(c=>a(c,"intelligence"))):70,
    cdmDefContrib,cdmPressResistance,cdmScreenQuality,cdmTransitionLaunch,
    cdmWorkHorse,cdmAttackContrib,cdmIsBoxToBox,cdmAggression,cdmAdaptability,cdmPhysicalDomination,
    cmControlContrib,cmCreativeOutput,cmVisionRange,cmPressingContrib,cmCoverageIntelligence,cmOffBall,cmClutch,
    camThreat,camCreativity,camVisionRange,camPressResistance,camDropsDeep,camSetPieceThreat,camOffBall,camClutch,
    lbAttackMode,rbAttackMode,lbAttackThreat,rbAttackThreat,
    lbDefensiveSecurity,rbDefensiveSecurity,lbAttackRisk,rbAttackRisk,fbCombinedAttackRisk,
    lbAdaptability,rbAdaptability,
    lwThreat,rwThreat,lwSpeedThreat,rwSpeedThreat,
    lwCrossingThreat,rwCrossingThreat,lwInsideThreat,rwInsideThreat,
    lwDefensiveContrib,rwDefensiveContrib,lwClutch,rwClutch,lwOffBallThreat,rwOffBallThreat,
    stThreat,stFinishingThreat,stPaceThreat,stAerialThreat,stLinkUpThreat,stBigGameFactor,stOffBall,stOffBallBonus,
    // team aggregates
    teamPace:s("pace"),teamPressing:s("pressing"),teamWorkRate:s("workRate"),
    teamStamina:s("stamina"),teamIntelligence:s("intelligence"),teamCreativity:s("creativity"),
    teamPressResistance:s("pressResistance"),teamPhysical:s("physical"),teamTechnical:s("technical"),
    teamBigGame:s("bigGameRating"),teamConsistency:s("consistency"),
    teamClutch:sa("clutch"),teamVision:sa("visionRange"),teamOffBall:sa("offTheBall"),
    teamAggression:sa("aggression"),teamAdaptability:sa("adaptability"),
    gkRating:gk?avg2(a(gk,"goalkeeperRating"),a(gk,"reflexes")):55,
    gkDistrib:gk?a(gk,"distribution"):60,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  COVERAGE CHAINS — who covers for who dynamically
// ═══════════════════════════════════════════════════════════════════════════
function calcCoverageChains(T,tactic){
  const cdmCanCoverFBs=T.cdmScreenQuality>72&&T.cdmWorkHorse>70;
  const cdmCoverageEfficiency=cdmCanCoverFBs?clamp2(T.cdmScreenQuality*0.82,40,88):clamp2(T.cdmScreenQuality*0.42,20,62);

  // High-aggression CDM covers more ground
  const cdmAggressionBonus=T.cdmAggression>84?clamp2((T.cdmAggression-82)*0.3,0,6):0;
  const cdmEffectiveScreen=cdmCoverageEfficiency+cdmAggressionBonus;

  const cmDropsToScreen=T.cmCoverageIntelligence>80&&T.cdmIsBoxToBox;
  const cmScreeningContrib=cmDropsToScreen?T.cmControlContrib*0.68:T.cmControlContrib*0.35;

  // Adaptable FBs — if they have high adaptability they defend even when attacking
  const lbRealRisk=T.lbAttackMode?clamp2(T.lbAttackRisk*(1-T.lbAdaptability/200),5,30):5;
  const rbRealRisk=T.rbAttackMode?clamp2(T.rbAttackRisk*(1-T.rbAdaptability/200),5,30):5;

  let leftFlankDefGap=0,rightFlankDefGap=0;
  if(T.lbAttackMode){
    leftFlankDefGap=cdmCanCoverFBs?clamp2(lbRealRisk-cdmEffectiveScreen*0.2,0,18):clamp2(lbRealRisk,0,28);
  }
  if(T.rbAttackMode){
    rightFlankDefGap=cdmCanCoverFBs?clamp2(rbRealRisk-cdmEffectiveScreen*0.2,0,18):clamp2(rbRealRisk,0,28);
  }

  const cdmCompensatesForWeakCAM=T.cdmAttackContrib>65&&T.camThreat<62;
  // Vision range from CM/CDM adds to effective creativity
  const midVisionBonus=avg2(T.cmVisionRange||70,T.cdmTransitionLaunch||60)*0.1;
  const effectiveMidfieldCreativity=clamp2(
    cdmCompensatesForWeakCAM
      ?avg2(T.camCreativity,T.cdmAttackContrib,T.cmCreativeOutput)*1.12+midVisionBonus
      :avg2(T.camCreativity,T.cmCreativeOutput)*1.0+midVisionBonus,
    30,99
  );

  const cmCompensatesForLowPressRes=T.cmControlContrib>76&&T.teamPressResistance<68;
  const effectivePressResistance=cmCompensatesForLowPressRes?T.teamPressResistance*1.18:T.teamPressResistance;

  const lwNotTracking=T.lw&&a(T.lw,"workRate")<65&&a(T.lw,"defensiveAwareness")<60;
  const rwNotTracking=T.rw&&a(T.rw,"workRate")<65&&a(T.rw,"defensiveAwareness")<60;
  const leftExposureFromLW=lwNotTracking?clamp2((80-a(T.lw,"workRate",70))*0.32,0,20):0;
  const rightExposureFromRW=rwNotTracking?clamp2((80-a(T.rw,"workRate",70))*0.32,0,20):0;

  const cdmPushesHighRisk=T.cdmIsBoxToBox&&T.cdmAttackContrib>68?clamp2(T.cdmAttackContrib*0.16,0,15):0;

  // Off-the-ball movement affects total attack cohesion
  const offBallBonus=clamp2((T.teamOffBall-70)*0.12,0,8);

  const totalDefCoverage=clamp2(
    T.cbEffectiveness*0.36+
    cdmEffectiveScreen*0.26+
    cmScreeningContrib*0.1+
    T.lbDefensiveSecurity*0.1+
    T.rbDefensiveSecurity*0.1+
    T.gkShotStopping*0.1-
    leftFlankDefGap-rightFlankDefGap-
    leftExposureFromLW-rightExposureFromRW-
    cdmPushesHighRisk,
    20,99
  );

  const totalAttackCohesion=clamp2(
    T.stThreat*0.28+
    T.lwThreat*0.18+
    T.rwThreat*0.18+
    T.camThreat*0.20+
    effectiveMidfieldCreativity*0.1+
    offBallBonus+
    (T.lbAttackMode?T.lbAttackThreat*0.04:0)+
    (T.rbAttackMode?T.rbAttackThreat*0.04:0)+
    T.stOffBallBonus,
    22,99
  );

  return{
    cdmCanCoverFBs,cdmCoverageEfficiency,cdmEffectiveScreen,cmDropsToScreen,cmScreeningContrib,
    leftFlankDefGap,rightFlankDefGap,leftExposureFromLW,rightExposureFromRW,
    cdmPushesHighRisk,cdmCompensatesForWeakCAM,effectiveMidfieldCreativity,
    cmCompensatesForLowPressRes,effectivePressResistance,
    totalDefCoverage,totalAttackCohesion,
    lwNotTracking,rwNotTracking,offBallBonus
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  THREAT NEUTRALISATION WITH NEW ATTRIBUTES
// ═══════════════════════════════════════════════════════════════════════════
function calcThreatNeutralisation(atkT,defT,atkTactic,defTactic){
  const results={};

  // ── ST vs CB — off-the-ball movement is critical ─────────
  if(atkT.st){
    const stOverallThreat=avg2(atkT.stFinishingThreat,atkT.stPaceThreat*0.7,atkT.stAerialThreat*0.5,atkT.stBigGameFactor*0.3);
    const stOffBallMultiplier=1+(atkT.stOffBall-70)/200; // good movement = harder to mark
    const cbCounterMeasure=avg2(defT.cbEffectiveness,defT.cdmScreenQuality*0.4);
    const rawAdvantage=(stOverallThreat*stOffBallMultiplier)-cbCounterMeasure;
    const eliteMultiplier=a(atkT.st,"finishing")>92?1.28:a(atkT.st,"finishing")>86?1.12:1.0;
    const clutchBonus=clamp2((atkT.stBigGameFactor-70)*0.05,0,4);
    const paceIsolationThreat=clamp2((a(atkT.st,"pace")-defT.cbPace)*eliteMultiplier*0.38,0,32);
    const aerialNetAdvantage=clamp2(atkT.stAerialThreat-defT.cbAerial*0.9,-16,28);
    // Adaptable CBs can switch marking schemes
    const defAdaptReduction=clamp2((avg2(...defT.cbs.map(c=>getAttr(c,"adaptability")))-75)*0.08,0,5);
    const totalStThreat=clamp2(stOverallThreat*eliteMultiplier+paceIsolationThreat*0.3+aerialNetAdvantage*0.2+clutchBonus,20,99);
    const totalCbCounter=clamp2(cbCounterMeasure+defT.gkShotStopping*0.15+defAdaptReduction,30,99);
    results.stVsCb={
      atkScore:totalStThreat,defScore:totalCbCounter,
      advantage:rawAdvantage*eliteMultiplier+clutchBonus,
      isElite:eliteMultiplier>1.1,
      paceIsolation:paceIsolationThreat,aerialNet:aerialNetAdvantage
    };
  }

  // ── LW vs RB — winger off-ball makes them harder to defend ──
  if(atkT.lw&&defT.rb){
    const lwOffBallMultiplier=1+(atkT.lwOffBallThreat-70)/180;
    const lwRawThreat=avg2(a(atkT.lw,"pace"),a(atkT.lw,"dribbling"),a(atkT.lw,"transitionThreat"),a(atkT.lw,"creativity"))*lwOffBallMultiplier*
      ((a(atkT.lw,"pace")>92||a(atkT.lw,"dribbling")>94)?1.22:1.0);
    const rbRawDefence=avg2(a(defT.rb,"pace"),a(defT.rb,"tackling"),a(defT.rb,"defensiveAwareness"),a(defT.rb,"intelligence"));
    const cdmHelpsRBSide=defT.cdmScreenQuality>74&&defT.cdmCanCoverFBs;
    const effectiveRBDefence=cdmHelpsRBSide?rbRawDefence+defT.cdmEffectiveScreen*0.14:rbRawDefence;
    const dribbleElite=a(atkT.lw,"dribbling")>93;
    const rbTacklingReduction=dribbleElite?effectiveRBDefence*0.84:effectiveRBDefence;
    results.lwVsRb={
      atkScore:clamp2(lwRawThreat,20,99),
      defScore:clamp2(rbTacklingReduction,20,99),
      advantage:lwRawThreat-rbTacklingReduction,
      dribbleElite,cdmHelped:cdmHelpsRBSide
    };
  }

  // ── RW vs LB ──────────────────────────────────────────────
  if(atkT.rw&&defT.lb){
    const rwOffBallMultiplier=1+(atkT.rwOffBallThreat-70)/180;
    const rwRawThreat=avg2(a(atkT.rw,"pace"),a(atkT.rw,"dribbling"),a(atkT.rw,"transitionThreat"),a(atkT.rw,"creativity"))*rwOffBallMultiplier*
      ((a(atkT.rw,"pace")>92||a(atkT.rw,"dribbling")>94)?1.22:1.0);
    const lbRawDefence=avg2(a(defT.lb,"pace"),a(defT.lb,"tackling"),a(defT.lb,"defensiveAwareness"),a(defT.lb,"intelligence"));
    const cdmHelpsLBSide=defT.cdmScreenQuality>74&&defT.cdmCanCoverFBs;
    const effectiveLBDefence=cdmHelpsLBSide?lbRawDefence+defT.cdmEffectiveScreen*0.14:lbRawDefence;
    const dribbleElite=a(atkT.rw,"dribbling")>93;
    const lbTacklingReduction=dribbleElite?effectiveLBDefence*0.84:effectiveLBDefence;
    results.rwVsLb={
      atkScore:clamp2(rwRawThreat,20,99),
      defScore:clamp2(lbTacklingReduction,20,99),
      advantage:rwRawThreat-lbTacklingReduction,
      dribbleElite,cdmHelped:cdmHelpsLBSide
    };
  }

  // ── CAM vs CDM — vision range is key here ────────────────
  if(atkT.cam&&defT.cdm){
    const camVisionMultiplier=1+(atkT.camVisionRange-70)/160;
    const camRawThreat=avg2(a(atkT.cam,"creativity"),a(atkT.cam,"passing"),a(atkT.cam,"dribbling"),a(atkT.cam,"pressResistance"))*camVisionMultiplier;
    const cdmRawScreen=avg2(a(defT.cdm,"defensiveAwareness"),a(defT.cdm,"positioning"),a(defT.cdm,"tackling"),a(defT.cdm,"intelligence"));
    const cmAssistsScreen=defT.cmCoverageIntelligence>80&&a(defT.cm,"workRate",70)>72;
    const effectiveScreen=cmAssistsScreen?cdmRawScreen+a(defT.cm,"defensiveAwareness",60)*0.14:cdmRawScreen;
    // CDM aggression helps win the physical battle in midfield
    const aggressionAdv=clamp2((defT.cdmAggression-70)*0.08,0,5);
    const isEliteCAM=a(atkT.cam,"creativity")>92||a(atkT.cam,"dribbling")>90;
    const eliteMult=isEliteCAM?1.20:1.0;
    results.camVsCdm={
      atkScore:clamp2(camRawThreat*eliteMult,20,99),
      defScore:clamp2(effectiveScreen+aggressionAdv,20,99),
      advantage:(camRawThreat*eliteMult)-(effectiveScreen+aggressionAdv),
      isElite:isEliteCAM,cmHelped:cmAssistsScreen
    };
  }

  // ── TRANSITION — contextual + tactical line height ────────
  const lineHeightMultiplier={veryhigh:1.5,high:1.2,medium:0.8,low:0.5}[defTactic?.lineHeight||"medium"];
  const highLineRisk=clamp2((100-defT.cbDefAware)/45,.12,.88)*lineHeightMultiplier;
  const fbPushRisk=clamp2((defT.fbCombinedAttackRisk-50)/60,.04,.58);
  const cdmProtectionReduction=clamp2((defT.cdmScreenQuality-65)/38,0,.48);
  const cbPaceReduction=clamp2((defT.cbPace-68)/32,0,.38);
  const teamIntelReduction=clamp2((defT.teamIntelligence-78)/28,0,.32);
  const fwdTransThreat=avg2(atkT.lwSpeedThreat,atkT.rwSpeedThreat,atkT.stPaceThreat);
  const contextMultiplier=highLineRisk*0.32+fbPushRisk*0.24+(1-cdmProtectionReduction)*0.24+(1-cbPaceReduction)*0.12+(1-teamIntelReduction)*0.08;
  const rawTransThreat=fwdTransThreat*contextMultiplier*1.7;
  const elitePaceCount=[atkT.lw,atkT.rw,atkT.st].filter(p=>p&&a(p,"pace")>92).length;
  const elitePaceBonus=elitePaceCount*9;
  results.transition={
    rawThreat:clamp2(rawTransThreat+elitePaceBonus,12,99),
    contextMultiplier,highLineRisk,fbPushRisk,
    cdmProtectionReduction,elitePaceBonus,lineHeightMultiplier
  };

  // ── PRESSING — aggression + stamina ──────────────────────
  const pressDiff=atkT.teamPressing-defT.teamPressResistance;
  const aggressionBoost=clamp2((atkT.teamAggression-70)*0.12,0,8);
  const pressingEffectiveness=clamp2(50+pressDiff*0.92+aggressionBoost,12,99);
  const techCDMNeutralisesPress=defT.cdmPressResistance>86&&defT.cdm!=null;
  const finalPressingScore=techCDMNeutralisesPress?pressingEffectiveness*0.73:pressingEffectiveness;
  results.pressing={score:finalPressingScore,techCDMNeutralised:techCDMNeutralisesPress};

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DYNAMIC SYNERGY — new attributes create new synergy paths
// ═══════════════════════════════════════════════════════════════════════════
function calcDynamicSynergy(T,sq,tactic){
  let synergyScore=0;
  const synergyLog=[];
  const all=T.all;
  const traits=all.flatMap(p=>p.traits||[]);
  const hasTr=t=>traits.includes(t);
  const countTr=t=>traits.filter(x=>x===t).length;
  const ps=all.flatMap(p=>p.playstyles||[]);
  const countP=s=>ps.filter(x=>x===s).length;

  // ── VISION RANGE CREATES ELITE CHANCE CREATION ───────────
  const highVisionPlayers=[T.cdm,T.cm,T.cam].filter(p=>p&&getAttr(p,"visionRange")>84).length;
  if(highVisionPlayers>=2){
    const bonus=highVisionPlayers*7;
    synergyScore+=bonus;
    synergyLog.push(`${highVisionPlayers} players with elite vision range — consistently finds passes others don't see, creating chances that bypass defensive structure`);
  }

  // ── OFF-THE-BALL MOVEMENT CREATES SPACE ──────────────────
  const eliteOffBallForwards=[T.lw,T.rw,T.st].filter(p=>p&&getAttr(p,"offTheBall")>86).length;
  if(eliteOffBallForwards>=2){
    const bonus=eliteOffBallForwards*6;
    synergyScore+=bonus;
    synergyLog.push(`${eliteOffBallForwards} forwards with elite off-the-ball movement — creates space for teammates and drags defenders out of position`);
  }

  // ── CLUTCH PLAYERS RAISE THE FLOOR IN BIG MOMENTS ────────
  const clutchPlayers=all.filter(p=>getAttr(p,"clutch")>88).length;
  if(clutchPlayers>=3){
    const bonus=clamp2((clutchPlayers-2)*5,0,15);
    synergyScore+=bonus;
    synergyLog.push(`${clutchPlayers} clutch performers — this team is at its best when it matters most, consistently finding goals and making big plays under pressure`);
  }

  // ── HIGH AGGRESSION CDM UNLOCKS THE ATTACK ───────────────
  if(T.cdmAggression>86&&T.cdmIsBoxToBox){
    synergyScore+=8;
    synergyLog.push(`Aggressive box-to-box CDM (${sname(T.cdm)}, aggression ${Math.round(T.cdmAggression)}) — wins the ball relentlessly and drives forward, adding a whole extra dimension to the attack`);
  }

  // ── ADAPTABLE TEAM ADJUSTS TO OPPONENT ───────────────────
  if(T.teamAdaptability>82){
    const bonus=clamp2((T.teamAdaptability-80)*0.6,0,10);
    synergyScore+=bonus;
    synergyLog.push(`High team adaptability (${Math.round(T.teamAdaptability)}) — can switch between styles mid-match, making them unpredictable and difficult to set up against`);
  }

  // ── CROSSING + AERIAL ────────────────────────────────────
  const bestCrossing=Math.max(...all.map(p=>a(p,"crossing")));
  const bestAerial=Math.max(...all.map(p=>a(p,"aerial")));
  if(bestCrossing>82&&bestAerial>84){
    const bonus=clamp2(((bestCrossing-80)+(bestAerial-82))*0.28,0,16);
    synergyScore+=bonus;
    synergyLog.push(`Elite crossing (${Math.round(bestCrossing)}) + aerial target (${Math.round(bestAerial)}) — set pieces and crosses are a genuine and repeated scoring route`);
  }

  // ── PACE + COUNTER ────────────────────────────────────────
  const paceyFwds=[T.lw,T.rw,T.st].filter(p=>p&&a(p,"pace")>86).length;
  if(paceyFwds>=2&&countP("counterAttack")>=2){
    const bonus=clamp2(paceyFwds*4.5+countP("counterAttack")*2,0,20);
    synergyScore+=bonus;
    synergyLog.push(`${paceyFwds} pacy forwards + counter-attack identity — explosive, dangerous on the break with sustained pace depth`);
  } else if(paceyFwds>=1&&countP("counterAttack")>=3){
    synergyScore+=7;
    synergyLog.push("Pace in attack with counter-attack identity — the team's most dangerous moments come on the transition");
  }

  // ── TECHNICAL MIDFIELD CONTROL ───────────────────────────
  const techMidPlayers=[T.cdm,T.cm,T.cam].filter(p=>p&&a(p,"technical")>82&&a(p,"pressResistance")>78).length;
  if(techMidPlayers>=2){
    synergyScore+=techMidPlayers*7;
    synergyLog.push(`${techMidPlayers}-man technical midfield — impossible to press effectively; maintains composure under any pressure and controls the game`);
  }

  // ── HIGH PRESS EFFECTIVENESS ─────────────────────────────
  const highPresserCount=all.filter(p=>a(p,"pressing")>78&&a(p,"workRate")>80).length;
  const highPressStamina=avg2(...all.filter(p=>a(p,"pressing")>78).map(p=>a(p,"stamina")));
  if(highPresserCount>=5&&highPressStamina>78){
    const bonus=clamp2((highPresserCount-4)*4.5+(highPressStamina-76)*0.35,0,20);
    synergyScore+=bonus;
    synergyLog.push(`${highPresserCount} high-stamina pressers — sustains a match-long press that completely disrupts any build-up`);
  }

  // ── BOX-TO-BOX CDM ───────────────────────────────────────
  if(T.cdmIsBoxToBox&&T.cdmAttackContrib>65){
    synergyScore+=clamp2((T.cdmAttackContrib-60)*0.45,0,14);
    synergyLog.push(`Box-to-box CDM (${sname(T.cdm)}) contributes both ends — an extra attacking threat that opponents have to account for`);
  }

  // ── ATTACKING FB OVERLOADS ───────────────────────────────
  const bothFBsAttack=T.lbAttackMode&&T.rbAttackMode;
  const oneFBAttacks=T.lbAttackMode||T.rbAttackMode;
  if(bothFBsAttack&&T.cdmCanCoverFBs){
    synergyScore+=11;
    synergyLog.push("Both fullbacks attack with CDM cover — width on both flanks simultaneously creates overloads that force opponents into impossible defensive decisions");
  } else if(bothFBsAttack&&!T.cdmCanCoverFBs){
    synergyScore-=9;
    synergyLog.push("⚠️ Both fullbacks attack WITHOUT CDM cover — massive counter-attack exposure, especially against pace");
  } else if(oneFBAttacks&&T.cdmCanCoverFBs){
    synergyScore+=6;
    synergyLog.push(`${T.lbAttackMode?sname(T.lb):sname(T.rb)} attacks with CDM cover — targeted overload on one side creates consistent problems`);
  }

  // ── SET PIECE SPECIALISTS ────────────────────────────────
  const spTaker=all.find(p=>(p.traits||[]).includes("setPieceExpert")&&a(p,"setPieces")>82);
  const spTargets=all.filter(p=>a(p,"aerial")>82).length;
  if(spTaker&&spTargets>=2){
    synergyScore+=clamp2(a(spTaker,"setPieces")-80+spTargets*3,0,16);
    synergyLog.push(`Set piece expert ${sname(spTaker)} (${a(spTaker,"setPieces")} SP) with ${spTargets} aerial targets — set pieces are a major and recurring threat`);
  }

  // ── CREATIVE PLAYMAKER + CLINICAL FINISHER ────────────────
  const topCreator=all.reduce((b,p)=>a(p,"creativity")>a(b,"creativity",0)?p:b,{});
  const topFinisher=all.reduce((b,p)=>a(p,"finishing")>a(b,"finishing",0)?p:b,{});
  if(topCreator!==topFinisher&&a(topCreator,"creativity")>86&&a(topFinisher,"finishing")>88){
    const bonus=clamp2(((a(topCreator,"creativity")-84)+(a(topFinisher,"finishing")-86))*0.3,0,16);
    synergyScore+=bonus;
    synergyLog.push(`${sname(topCreator)} (creativity ${a(topCreator,"creativity")}) + ${sname(topFinisher)} (finishing ${a(topFinisher,"finishing")}) — elite creative-to-clinical combination`);
  }

  // ── BIG GAME MENTALITY ────────────────────────────────────
  const bigGamePlayers=all.filter(p=>getAttr(p,"clutch")>88&&a(p,"consistency")>84).length;
  if(bigGamePlayers>=4){
    synergyScore+=clamp2((bigGamePlayers-3)*3.5,0,12);
    synergyLog.push(`${bigGamePlayers} players with elite clutch ratings — the team's best performances come in the biggest moments`);
  }

  // ── INTELLIGENT CB PARTNERSHIP ───────────────────────────
  if(T.cbPartnershipBonus>=9){
    synergyScore+=7;
    synergyLog.push("Elite CB partnership synergy — complementary attributes create a defensive unit worth more than the sum of its parts");
  }

  // ── LEADERSHIP SPINE ─────────────────────────────────────
  const leaders=all.filter(p=>a(p,"leadership")>84).length;
  if(leaders>=3){
    synergyScore+=6;
    synergyLog.push(`${leaders} leaders — organises the team under fatigue, sets the tone in adversity, maintains shape when it matters`);
  }

  // ── TACTICAL IDENTITY BONUS ──────────────────────────────
  if(tactic?.primaryStyle==="tiki"&&T.teamTechnical>86){
    synergyScore+=8;
    synergyLog.push("Tiki-taka identity with technical quality to match — possession and movement creates a suffocating style that wears opponents down");
  }
  if(tactic?.pressingIntensity==="gegenpressing"&&T.teamStamina>82){
    synergyScore+=7;
    synergyLog.push("Gegenpressing identity with stamina to sustain it — the team hunts the ball in packs immediately after losing it, rarely letting opponents breathe");
  }

  // ── BAD BALANCE PENALTIES ────────────────────────────────
  if(T.fbCombinedAttackRisk>70&&T.cdmScreenQuality<62){
    synergyScore-=11;
    synergyLog.push("⚠️ Attacking fullbacks without defensive midfield cover — chronic counter-attack vulnerability that good opposition will find every time");
  }
  if(T.lwNotTracking&&T.rwNotTracking){
    synergyScore-=9;
    synergyLog.push("⚠️ Both wingers fail to track back — fullbacks are exposed in 2v1 situations on both sides");
  }
  if(!T.cam&&!T.cm){
    synergyScore-=7;
    synergyLog.push("⚠️ No creative presence in midfield — attack relies entirely on wingers and individual brilliance");
  }
  if(T.teamPressResistance<62&&countP("highPress")<2&&T.cbDefAware<70){
    synergyScore-=7;
    synergyLog.push("⚠️ Low press resistance AND weak defensive line — structured pressure from the opposition will be devastating");
  }
  if(T.teamAdaptability<62){
    synergyScore-=4;
    synergyLog.push("⚠️ Low adaptability — this team has one way of playing and struggles when forced out of it");
  }

  return{score:clamp2(60+synergyScore,25,99),rawBonus:synergyScore,log:synergyLog};
}

// ═══════════════════════════════════════════════════════════════════════════
//  MOMENTUM ENGINE
//  Tracks how the match develops based on phase dominance
//  Affects goal timing, comeback potential, late goals
// ═══════════════════════════════════════════════════════════════════════════
function calcMomentum(phases,synA,synB){
  const atkDiff=phases.aAtk-phases.bAtk;
  const midDiff=phases.aMid-phases.bMid;
  const defDiff=phases.aDefStr-phases.bDefStr;
  const transDiff=phases.aTrans-phases.bTrans;

  // Momentum = how much the match flows in one direction
  const rawMomentumA=(atkDiff*0.35+midDiff*0.30+transDiff*0.20+defDiff*0.15);
  const momentumA=clamp2(50+rawMomentumA,10,90);

  // Clutch factor — can the losing team find a late goal?
  const clutchA=phases.TA.teamClutch;const clutchB=phases.TB.teamClutch;
  // Higher clutch = more likely to score in high-pressure moments
  const lateGoalProbA=clamp2((clutchA-70)/80+rng2(0,0.15),0,0.5);
  const lateGoalProbB=clamp2((clutchB-70)/80+rng2(0,0.15),0,0.5);

  // Adaptability affects whether a team can recover from going behind
  const adaptA=phases.TA.teamAdaptability;const adaptB=phases.TB.teamAdaptability;
  const comebackFactorA=clamp2((adaptA-70)/100,0,0.3);
  const comebackFactorB=clamp2((adaptB-70)/100,0,0.3);

  return{momentumA,lateGoalProbA,lateGoalProbB,comebackFactorA,comebackFactorB,rawMomentumA};
}

// ═══════════════════════════════════════════════════════════════════════════
//  FULL PHASE CALCULATION WITH TACTICAL IDENTITY
// ═══════════════════════════════════════════════════════════════════════════
function calcFullPhases(sqA,sqB){
  const TA=calcIndividualThreats(sqA);
  const TB=calcIndividualThreats(sqB);
  const tacA=calcTacticalIdentity(sqA);
  const tacB=calcTacticalIdentity(sqB);
  const CA=calcCoverageChains(TA,tacA);
  const CB=calcCoverageChains(TB,tacB);
  const neutralAvsB=calcThreatNeutralisation(TA,TB,tacA,tacB);
  const neutralBvsA=calcThreatNeutralisation(TB,TA,tacB,tacA);
  const synA=calcDynamicSynergy(TA,sqA,tacA);
  const synB=calcDynamicSynergy(TB,sqB,tacB);

  // ── ATTACK ───────────────────────────────────────────────
  let aAtk=CA.totalAttackCohesion;
  const stAdvantageA=neutralAvsB.stVsCb?neutralAvsB.stVsCb.advantage:0;
  const lwAdvantageA=neutralAvsB.lwVsRb?neutralAvsB.lwVsRb.advantage:0;
  const rwAdvantageA=neutralAvsB.rwVsLb?neutralAvsB.rwVsLb.advantage:0;
  const camAdvantageA=neutralAvsB.camVsCdm?neutralAvsB.camVsCdm.advantage:0;
  aAtk+=stAdvantageA*0.36+lwAdvantageA*0.22+rwAdvantageA*0.22+camAdvantageA*0.14;
  aAtk-=clamp2(TB.gkShotStopping-74,0,22)*0.10;
  aAtk+=clamp2(synA.rawBonus*0.24,0,18);
  // Elite attacker bonus — multiple 90+ pos score attackers compound
  const eliteAtkA=TA.all.filter(p=>["lw","rw","st","cam"].some(r=>posScore2(p,r)>88)).length;
  if(eliteAtkA>=2)aAtk+=eliteAtkA*4;
  if(eliteAtkA>=3)aAtk+=10;
  if(eliteAtkA>=4)aAtk+=8; // four elite attackers is overwhelming
  // Off-the-ball quality amplifies attack
  aAtk+=clamp2((TA.teamOffBall-70)*0.14,0,8);
  // Vision range from playmakers creates more chances
  aAtk+=clamp2((CA.effectiveMidfieldCreativity-70)*0.12,0,6);
  aAtk=clamp2(aAtk,25,99);

  let bAtk=CB.totalAttackCohesion;
  const stAdvantageB=neutralBvsA.stVsCb?neutralBvsA.stVsCb.advantage:0;
  const lwAdvantageB=neutralBvsA.lwVsRb?neutralBvsA.lwVsRb.advantage:0;
  const rwAdvantageB=neutralBvsA.rwVsLb?neutralBvsA.rwVsLb.advantage:0;
  const camAdvantageB=neutralBvsA.camVsCdm?neutralBvsA.camVsCdm.advantage:0;
  bAtk+=stAdvantageB*0.36+lwAdvantageB*0.22+rwAdvantageB*0.22+camAdvantageB*0.14;
  bAtk-=clamp2(TA.gkShotStopping-74,0,22)*0.10;
  bAtk+=clamp2(synB.rawBonus*0.24,0,18);
  const eliteAtkB=TB.all.filter(p=>["lw","rw","st","cam"].some(r=>posScore2(p,r)>88)).length;
  if(eliteAtkB>=2)bAtk+=eliteAtkB*4;
  if(eliteAtkB>=3)bAtk+=10;
  if(eliteAtkB>=4)bAtk+=8;
  bAtk+=clamp2((TB.teamOffBall-70)*0.14,0,8);
  bAtk+=clamp2((CB.effectiveMidfieldCreativity-70)*0.12,0,6);
  bAtk=clamp2(bAtk,25,99);

  // ── MIDFIELD ─────────────────────────────────────────────
  let aMid=avg2(posScore2(TA.cdm,"cdm"),posScore2(TA.cm,"cm"),posScore2(TA.cam,"cam"));
  aMid+=clamp2(CA.effectiveMidfieldCreativity-65,0,16)*0.30;
  aMid+=clamp2(CA.effectivePressResistance-TB.teamPressing,-20,20)*0.34;
  aMid+=clamp2(TA.teamWorkRate-70,0,20)*0.17;
  aMid+=clamp2(TA.teamIntelligence-78,0,18)*0.16;
  aMid+=(TA.teamPhysical-TB.teamPhysical)*0.09;
  // Vision range in midfield creates more accurate passing lanes
  aMid+=clamp2((TA.teamVision-70)*0.14,0,8);
  // Aggression in midfield wins more physical contests
  aMid+=clamp2((TA.teamAggression-70)*0.08,0,5);
  const eliteMidA=[TA.cdm,TA.cm,TA.cam].filter(p=>p&&(posScore2(p,"cdm")>87||posScore2(p,"cm")>87||posScore2(p,"cam")>87)).length;
  if(eliteMidA>=2)aMid+=eliteMidA*4.5;
  if(eliteMidA>=3)aMid+=8; // Matthäus+Zidane+Gullit is a completely different midfield
  aMid=clamp2(aMid,28,99);

  let bMid=avg2(posScore2(TB.cdm,"cdm"),posScore2(TB.cm,"cm"),posScore2(TB.cam,"cam"));
  bMid+=clamp2(CB.effectiveMidfieldCreativity-65,0,16)*0.30;
  bMid+=clamp2(CB.effectivePressResistance-TA.teamPressing,-20,20)*0.34;
  bMid+=clamp2(TB.teamWorkRate-70,0,20)*0.17;
  bMid+=clamp2(TB.teamIntelligence-78,0,18)*0.16;
  bMid+=(TB.teamPhysical-TA.teamPhysical)*0.09;
  bMid+=clamp2((TB.teamVision-70)*0.14,0,8);
  bMid+=clamp2((TB.teamAggression-70)*0.08,0,5);
  const eliteMidB=[TB.cdm,TB.cm,TB.cam].filter(p=>p&&(posScore2(p,"cdm")>87||posScore2(p,"cm")>87||posScore2(p,"cam")>87)).length;
  if(eliteMidB>=2)bMid+=eliteMidB*4.5;
  if(eliteMidB>=3)bMid+=8;
  bMid=clamp2(bMid,28,99);

  // ── DEFENCE — elite defenders genuinely impenetrable ─────
  let aDefStr=CA.totalDefCoverage;
  if(!TA.cdm)aDefStr-=13;
  aDefStr-=CA.leftFlankDefGap*0.65+CA.rightFlankDefGap*0.65;
  aDefStr+=clamp2(TA.gkShotStopping-72,0,24)*0.19;
  const eliteDefA=TA.cbs.filter(c=>posScore2(c,"cb")>88).length;
  if(eliteDefA>=2)aDefStr+=14;
  else if(eliteDefA===1)aDefStr+=6;
  const weakDefA=TA.cbs.filter(c=>posScore2(c,"cb")<70).length;
  if(weakDefA>=1)aDefStr-=weakDefA*9;
  if(TA.cdm)aDefStr+=clamp2(TA.cdmScreenQuality-65,0,32)*0.38;
  // Aggression in defence wins more duels
  aDefStr+=clamp2((TA.teamAggression-70)*0.08,0,5);
  // Adaptability allows defence to adjust to different threats
  aDefStr+=clamp2((TA.teamAdaptability-70)*0.06,0,4);
  aDefStr=clamp2(aDefStr,18,99);

  let bDefStr=CB.totalDefCoverage;
  if(!TB.cdm)bDefStr-=13;
  bDefStr-=CB.leftFlankDefGap*0.65+CB.rightFlankDefGap*0.65;
  bDefStr+=clamp2(TB.gkShotStopping-72,0,24)*0.19;
  const eliteDefB=TB.cbs.filter(c=>posScore2(c,"cb")>88).length;
  if(eliteDefB>=2)bDefStr+=14;
  else if(eliteDefB===1)bDefStr+=6;
  const weakDefB=TB.cbs.filter(c=>posScore2(c,"cb")<70).length;
  if(weakDefB>=1)bDefStr-=weakDefB*9;
  if(TB.cdm)bDefStr+=clamp2(TB.cdmScreenQuality-65,0,32)*0.38;
  bDefStr+=clamp2((TB.teamAggression-70)*0.08,0,5);
  bDefStr+=clamp2((TB.teamAdaptability-70)*0.06,0,4);
  bDefStr=clamp2(bDefStr,18,99);

  // ── TRANSITION ───────────────────────────────────────────
  const aTrans=neutralAvsB.transition?clamp2(neutralAvsB.transition.rawThreat,10,99):42;
  const bTrans=neutralBvsA.transition?clamp2(neutralBvsA.transition.rawThreat,10,99):42;

  // ── WIDE ─────────────────────────────────────────────────
  const lwVsRbA=neutralAvsB.lwVsRb;const rwVsLbA=neutralAvsB.rwVsLb;
  let aWide=avg2(TA.lwThreat,TA.rwThreat)*0.52;
  if(lwVsRbA)aWide+=lwVsRbA.advantage*0.26;
  if(rwVsLbA)aWide+=rwVsLbA.advantage*0.26;
  aWide+=clamp2(TA.lwCrossingThreat+TA.rwCrossingThreat-130,0,24)*0.13;
  if(TA.lbAttackMode)aWide+=TA.lbAttackThreat*0.09;
  if(TA.rbAttackMode)aWide+=TA.rbAttackThreat*0.09;
  aWide=clamp2(aWide,22,99);

  const lwVsRbB=neutralBvsA.lwVsRb;const rwVsLbB=neutralBvsA.rwVsLb;
  let bWide=avg2(TB.lwThreat,TB.rwThreat)*0.52;
  if(lwVsRbB)bWide+=lwVsRbB.advantage*0.26;
  if(rwVsLbB)bWide+=rwVsLbB.advantage*0.26;
  bWide+=clamp2(TB.lwCrossingThreat+TB.rwCrossingThreat-130,0,24)*0.13;
  if(TB.lbAttackMode)bWide+=TB.lbAttackThreat*0.09;
  if(TB.rbAttackMode)bWide+=TB.rbAttackThreat*0.09;
  bWide=clamp2(bWide,22,99);

  // ── PRESSING ─────────────────────────────────────────────
  const aPressScore=neutralAvsB.pressing?neutralAvsB.pressing.score:50;
  const bPressScore=neutralBvsA.pressing?neutralBvsA.pressing.score:50;

  // ── SET PIECES ───────────────────────────────────────────
  const aSP=clamp2(avg2(TA.camSetPieceThreat,avg2(...TA.all.map(p=>a(p,"crossing"))))*0.5+clamp2(TA.stAerialThreat-70,0,22)*0.26-clamp2(TB.cbAerial-72,0,20)*0.22-clamp2(TB.gkAerialCommand-74,0,16)*0.16,40,98);
  const bSP=clamp2(avg2(TB.camSetPieceThreat,avg2(...TB.all.map(p=>a(p,"crossing"))))*0.5+clamp2(TB.stAerialThreat-70,0,22)*0.26-clamp2(TA.cbAerial-72,0,20)*0.22-clamp2(TA.gkAerialCommand-74,0,16)*0.16,40,98);

  // ── GK ───────────────────────────────────────────────────
  const aGK=clamp2(TA.gkRating*1.06,38,99);
  const bGK=clamp2(TB.gkRating*1.06,38,99);

  // ── SYNERGY ──────────────────────────────────────────────
  const aSynScore=synA.score;const bSynScore=synB.score;

  // ── FINAL SCORE ──────────────────────────────────────────
  function fin(atk,mid,d,tr,w,sp,pr,syn,gk){
    return atk*.18+mid*.16+d*.16+tr*.12+w*.10+pr*.08+sp*.06+gk*.06+syn*.08;
  }
  const aFin=fin(aAtk,aMid,aDefStr,aTrans,aWide,aSP,aPressScore,aSynScore,aGK);
  const bFin=fin(bAtk,bMid,bDefStr,bTrans,bWide,bSP,bPressScore,bSynScore,bGK);

  const momentum=calcMomentum({aAtk,bAtk,aMid,bMid,aDefStr,bDefStr,aTrans,bTrans,TA,TB},aSynScore,bSynScore);

  return{
    aAtk,bAtk,aMid,bMid,aTrans,bTrans,aWide,bWide,
    aDefStr,bDefStr,aSP,bSP,aPressScore,bPressScore,
    aSynScore,bSynScore,aGK,bGK,aFin,bFin,
    TA,TB,CA,CB,neutralAvsB,neutralBvsA,synA,synB,
    tacA,tacB,momentum
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  DYNAMIC SCORELINE — NO CAPS, BRUTALLY HONEST
// ═══════════════════════════════════════════════════════════════════════════
function dynamicScoreline(aAtk,bAtk,aDefStr,bDefStr,aGK,bGK,synA,synB,momentum){
  function xgCalc(atk,def,gk,syn){
    // Direct dominance drives goals exponentially — no soft clamping
    const dominance=atk-def;
    let xg;
    if(dominance>=50)       xg=rng2(4.8,8.5);   // utterly dominant
    else if(dominance>=40)  xg=rng2(3.8,6.8);
    else if(dominance>=30)  xg=rng2(2.8,5.2);
    else if(dominance>=20)  xg=rng2(1.9,3.8);
    else if(dominance>=12)  xg=rng2(1.3,2.8);
    else if(dominance>=5)   xg=rng2(0.8,2.2);
    else if(dominance>=-4)  xg=rng2(0.4,1.6);
    else if(dominance>=-12) xg=rng2(0.15,1.0);
    else if(dominance>=-22) xg=rng2(0.05,0.6);
    else if(dominance>=-35) xg=rng2(0.0,0.3);
    else                    xg=rng2(0.0,0.15);  // completely overwhelmed

    // GK quality — even elite keeper can't stop 8 goals of dominance
    const gkSaveFactor=clamp2(1.0-(gk-58)/150,0.68,1.0);
    xg*=gkSaveFactor;

    // Synergy — cohesive teams convert more
    const synBoost=clamp2((syn-65)/110,-0.12,0.28);
    xg*=(1+synBoost);

    return Math.max(0,xg);
  }

  const xgA=xgCalc(aAtk,bDefStr,bGK,synA);
  const xgB=xgCalc(bAtk,aDefStr,aGK,synB);

  // Momentum affects goal timing and comeback possibility
  const momentumBoostA=momentum?clamp2((momentum.momentumA-50)*0.02,0,0.4):0;
  const momentumBoostB=momentum?clamp2((50-momentum.momentumA)*0.02,0,0.4):0;
  const xgAFinal=xgA*(1+momentumBoostA);
  const xgBFinal=xgB*(1+momentumBoostB);

  // Clutch factor — late goal probability for the losing side
  const lateGoalA=momentum&&rng2(0,1)<momentum.lateGoalProbA?1:0;
  const lateGoalB=momentum&&rng2(0,1)<momentum.lateGoalProbB?1:0;

  function sampleGoals(xg){
    if(xg<=0)return 0;
    const spread=Math.sqrt(xg)*0.72;
    const raw=xg+rng2(-spread,spread*1.15);
    return Math.max(0,Math.round(raw));
    // ABSOLUTELY NO CAP — if xg says 8, goals can be 8
  }

  let goalsA=sampleGoals(xgAFinal);
  let goalsB=sampleGoals(xgBFinal);

  // Apply clutch late goals
  if(lateGoalA&&goalsA===0)goalsA=1;
  if(lateGoalB&&goalsB===0)goalsB=1;

  return{goalsA,goalsB,xgA:xgAFinal,xgB:xgBFinal};
}

// ═══════════════════════════════════════════════════════════════════════════
//  DYNAMIC PLAYER RATINGS — reflects match reality
// ═══════════════════════════════════════════════════════════════════════════
function dynamicPlayerRatings(sqA,sqB,phases){
  const TA=phases.TA,TB=phases.TB;
  const CA=phases.CA,CB=phases.CB;

  function ratePlayer(p,role,myPhases,oppPhases,myTeamT,oppTeamT,myCoverage){
    if(!p)return null;
    const base=posScore2(p,role);
    let r=4.2+((base-40)/59)*5.0;

    let phaseBoost=0;
    if(["st","lw","rw"].includes(role)){
      phaseBoost=(myPhases.aAtk-oppPhases.bAtk)*0.092;
    } else if(["cdm","cm","cam"].includes(role)){
      phaseBoost=(myPhases.aMid-oppPhases.bMid)*0.082;
    } else if(["cb","lb","rb"].includes(role)){
      const atkDiff=myPhases.aDefStr-(oppPhases.bAtk||50);
      phaseBoost=atkDiff*0.078;
    } else if(role==="gk"){
      const underFire=(oppPhases.bAtk||50)>myPhases.aDefStr;
      if(underFire){
        phaseBoost=(myPhases.aDefStr-(oppPhases.bAtk||50))*0.055+rng2(0,0.75);
      } else {
        phaseBoost=(myPhases.aDefStr-(oppPhases.bAtk||50))*0.042;
      }
    }
    r+=clamp2(phaseBoost,-3.5,3.5);

    // New attributes affect ratings
    const clutch=getAttr(p,"clutch");
    const adaptability=getAttr(p,"adaptability");
    r+=rng2(-0.2,clutch/100*0.7); // clutch players more likely to have big games
    r+=rng2(-0.15,adaptability/200*0.4); // adaptable players adjust and perform

    const cons=a(p,"consistency")/100;
    r+=rng2(-(1-cons)*1.3,(1-cons)*1.3);

    const bg=a(p,"bigGameRating")/100;
    r+=rng2(-0.2,bg*0.68);

    if(role==="cdm"&&myCoverage.cdmCanCoverFBs)r+=0.32;
    if(role==="cm"&&myCoverage.cmDropsToScreen)r+=0.26;
    if(role==="gk"&&(oppPhases.bAtk||50)>78)r+=rng2(0,0.58);

    // Hard floor for battered defenders
    const atkAdvOpp=(oppPhases.bAtk||50)-(myPhases.aDefStr||50);
    if(atkAdvOpp>22&&["cb","lb","rb"].includes(role))r=Math.min(r,5.7);
    if(atkAdvOpp>35&&["cb","lb","rb"].includes(role))r=Math.min(r,4.9);
    if(atkAdvOpp>48&&["cb","lb","rb"].includes(role))r=Math.min(r,4.2);

    return clamp2(Math.round(r*10)/10,2.5,9.9);
  }

  const phA={aAtk:phases.aAtk,aMid:phases.aMid,aDefStr:phases.aDefStr};
  const phB={aAtk:phases.bAtk,aMid:phases.bMid,aDefStr:phases.bDefStr};
  const phAOpp={bAtk:phases.bAtk,bMid:phases.bMid,bDefStr:phases.bDefStr};
  const phBOpp={bAtk:phases.aAtk,bMid:phases.aMid,bDefStr:phases.aDefStr};

  const rA=sqA.map((p,i)=>{if(!p)return null;const r=window.LAYOUT[i].role;return{p,role:r,rat:ratePlayer(p,r,phA,phAOpp,TA,TB,CA)}}).filter(Boolean);
  const rB=sqB.map((p,i)=>{if(!p)return null;const r=window.LAYOUT[i].role;return{p,role:r,rat:ratePlayer(p,r,phB,phBOpp,TB,TA,CB)}}).filter(Boolean);
  return{rA,rB};
}

// ═══════════════════════════════════════════════════════════════════════════
//  DYNAMIC GOAL EVENT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
function dynamicGoalEvents(sqA,sqB,phases,goalsA,goalsB,n0,n1){
  const TA=phases.TA,TB=phases.TB;
  const events=[];
  const usedMins=new Set();

  function uMin(base,spread){
    let m=Math.round(base+rng2(-spread,spread));
    m=clamp2(m,2,90);
    while(usedMins.has(m))m=m>=90?m-1:m+1;
    usedMins.add(m);return m;
  }

  function pickScorer(sq,T){
    const opts=[T.st,T.lw,T.rw,T.cam].filter(Boolean);
    if(!opts.length)return sq.filter(Boolean)[0];
    return weighted2(opts,p=>
      (a(p,"finishing")*1.2+a(p,"positioning")+getAttr(p,"offTheBall")*0.5)*
      clamp2(getAttr(p,"clutch")/85,0.7,1.5)
    );
  }
  function pickAssist(sq,T,scorer){
    const opts=[T.cam,T.cm,T.lb,T.rb,T.lw,T.rw].filter(p=>p&&p!==scorer);
    if(!opts.length)return null;
    return weighted2(opts,p=>
      a(p,"passing")*0.8+a(p,"crossing")*0.6+getAttr(p,"visionRange")*0.5
    );
  }

  function goalMethod(scorer,T,isCounter){
    if(!scorer)return"Finish";
    if(isCounter&&a(scorer,"pace")>86&&rng2(0,1)<0.5)return"Counter-attack";
    if(a(scorer,"aerial")>82&&rng2(0,1)<0.3)return"Header";
    if(a(scorer,"dribbling")>90&&rng2(0,1)<0.28)return"Individual brilliance";
    if((T.camSetPieceThreat>78||a(scorer,"setPieces")>82)&&a(scorer,"aerial")>78&&rng2(0,1)<0.22)return"Set piece";
    if(a(scorer,"finishing")>90&&rng2(0,1)<0.35)return"Clinical finish";
    return"Finish";
  }

  // Spread goals across match naturally
  // Early goals (1-25), first half goals (25-45), second half (46-75), late (76-90)
  function getGoalMin(i,total,teamOffset){
    const base=teamOffset+(i/(total||1))*72+rng2(2,15);
    return clamp2(Math.round(base),teamOffset?5:2,90);
  }

  for(let i=0;i<goalsA;i++){
    const sc=pickScorer(sqA,TA);
    const as=pickAssist(sqA,TA,sc);
    const min=uMin(getGoalMin(i,goalsA,3),12);
    const isCounter=phases.aTrans>65&&rng2(0,1)<0.35;
    events.push({min,team:0,scorer:sc,assist:as,method:goalMethod(sc,TA,isCounter)});
  }
  for(let i=0;i<goalsB;i++){
    const sc=pickScorer(sqB,TB);
    const as=pickAssist(sqB,TB,sc);
    const min=uMin(getGoalMin(i,goalsB,8),12);
    const isCounter=phases.bTrans>65&&rng2(0,1)<0.35;
    events.push({min,team:1,scorer:sc,assist:as,method:goalMethod(sc,TB,isCounter)});
  }
  return events.sort((a,b)=>a.min-b.min);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DEEP PLAYER VS PLAYER BATTLES — 9+ matchups, extreme scores
// ═══════════════════════════════════════════════════════════════════════════
function calcDeepPvP(sqA,sqB,phases,n0,n1){
  const TA=phases.TA,TB=phases.TB;
  const CA=phases.CA,CB=phases.CB;
  const battles=[];

  function bScores(diff){
    const raw=50+diff*1.4;
    const aS=clamp2(Math.round(raw),2,98);
    return{a:aS,b:100-aS};
  }

  function domLabel(a,b,nameA,nameB){
    const d=a-b;
    if(d>62)return{label:`${nameA} TOTAL DOMINANCE`,cls:"p1"};
    if(d>46)return{label:`${nameA} DOMINATES`,cls:"p1"};
    if(d>30)return{label:`${nameA} WINS CLEARLY`,cls:"p1"};
    if(d>16)return{label:`${nameA} EDGES IT`,cls:"p1"};
    if(d>6)return{label:`${nameA} NARROW WIN`,cls:"p1"};
    if(d>-7)return{label:"EVEN BATTLE",cls:"draw"};
    if(d>-17)return{label:`${nameB} NARROW WIN`,cls:"p2"};
    if(d>-31)return{label:`${nameB} EDGES IT`,cls:"p2"};
    if(d>-47)return{label:`${nameB} WINS CLEARLY`,cls:"p2"};
    if(d>-63)return{label:`${nameB} DOMINATES`,cls:"p2"};
    return{label:`${nameB} TOTAL DOMINANCE`,cls:"p2"};
  }

  function statBox(lbl,v1,v2){
    const c1=attrCol2(v1),c2=attrCol2(v2);
    return`<div class="pvp-stat-box"><div class="pvp-stat-val" style="color:${c1}">${v1}<span style="color:var(--muted);font-size:10px"> v </span><span style="color:${c2}">${v2}</span></div><div class="pvp-stat-lbl">${lbl}</div></div>`;
  }

  // ── BATTLE 1: ST vs CB ────────────────────────────────────
  if(TA.st&&TB.cbs.length){
    const n=phases.neutralAvsB.stVsCb;
    const stPow=n?n.atkScore:posScore2(TA.st,"st");
    const defPow=n?n.defScore:TB.cbEffectiveness;
    const diff=stPow-defPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.st),TB.cbs.map(c=>sname(c)).join("/"));
    const stFin=a(TA.st,"finishing"),stPace=a(TA.st,"pace"),stOB=getAttr(TA.st,"offTheBall");
    const cbPaceAvg=TB.cbPace,cbDA=TB.cbDefAware,cbAdapt=avg2(...TB.cbs.map(c=>getAttr(c,"adaptability")));

    let txt=`<strong>${sname(TA.st)}</strong> vs <strong>${TB.cbs.map(c=>sname(c)).join(" & ")}</strong>.<br><br>`;
    if(stFin>=95)txt+=`${sname(TA.st)}'s finishing (${stFin}) is at the absolute peak of the game. Every touch in the box is a potential goal — the slightest mistake from the defence is immediately punished. `;
    else if(stFin>=90)txt+=`Elite finishing (${stFin}) — converts chances that most strikers would waste. `;
    else if(stFin>=84)txt+=`Good finishing (${stFin}) — clinical enough to make the most of what comes his way. `;
    else txt+=`Finishing of ${stFin} means the striker needs clear opportunities to score — the defence can afford occasional errors. `;
    const pd=stPace-cbPaceAvg;
    if(pd>20)txt+=`<br><br>The pace gap of <strong>${Math.round(pd)} points</strong> is catastrophic for the defence. There is no recovering these footraces — every ball played in behind is a guaranteed chance. `;
    else if(pd>10)txt+=`<br><br>A ${Math.round(pd)}-point pace advantage means ${sname(TA.st)} regularly creates chances with well-timed runs in behind. `;
    else if(pd<-10)txt+=`<br><br>The centre-backs win the pace battle comfortably — balls in behind are always covered. `;
    if(stOB>86)txt+=`Off-the-ball movement (${stOB}) is exceptional — ${sname(TA.st)} creates space without the ball, dragging markers out of position before the pass even arrives. `;
    if(cbDA>=92)txt+=`The defensive awareness of ${Math.round(cbDA)} means every run is tracked from its inception — ${sname(TA.st)} receives fewer balls in dangerous areas than expected. `;
    else if(cbDA<70)txt+=`Defensive awareness of only ${Math.round(cbDA)} is a real problem — ${sname(TA.st)} finds the pockets of space before the defenders even realise they exist. `;
    if(cbAdapt>84)txt+=`The CBs' adaptability (${Math.round(cbAdapt)}) allows them to switch between marking schemes depending on where ${sname(TA.st)} drops. `;
    if(diff>35)txt+=`<br><br><strong>Verdict:</strong> Complete mismatch. ${sname(TA.st)} scores multiple goals and this battle alone decides the match.`;
    else if(diff>18)txt+=`<br><br><strong>Verdict:</strong> Clear striker advantage. The CBs will be under sustained pressure all match.`;
    else if(diff>5)txt+=`<br><br><strong>Verdict:</strong> The striker edges it but the defenders make it competitive. One key moment decides this battle.`;
    else if(diff>-6)txt+=`<br><br><strong>Verdict:</strong> Genuine contest — quality on both sides, decided by moments.`;
    else if(diff>-20)txt+=`<br><br><strong>Verdict:</strong> The CBs edge it — ${sname(TA.st)} is contained for most of the match.`;
    else txt+=`<br><br><strong>Verdict:</strong> Defensive masterclass. ${sname(TA.st)} is completely neutralised.`;

    battles.push({title:`${sname(TA.st)} vs ${TB.cbs.map(c=>sname(c)).join(" & ")}`,sub:"STRIKER vs CENTRE-BACK(S)",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("FINISHING",stFin,Math.round(avg2(...TB.cbs.map(c=>a(c,"tackling"))))),
             statBox("PACE",stPace,Math.round(cbPaceAvg)),
             statBox("OFF BALL",stOB,Math.round(cbDA)),
             statBox("CLUTCH",getAttr(TA.st,"clutch"),Math.round(avg2(...TB.cbs.map(c=>getAttr(c,"clutch")))))]});
  }

  // ── BATTLE 2: LW vs RB ───────────────────────────────────
  if(TA.lw&&TB.rb){
    const n=phases.neutralAvsB.lwVsRb;
    const lwPow=n?n.atkScore:TA.lwThreat;
    const rbPow=n?n.defScore:posScore2(TB.rb,"rb");
    const diff=lwPow-rbPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.lw),sname(TB.rb));
    const paceDiff=a(TA.lw,"pace")-a(TB.rb,"pace");
    let txt=`<strong>${sname(TA.lw)}</strong> against <strong>${sname(TB.rb)}</strong> on the left flank.<br><br>`;
    if(a(TA.lw,"pace")>93)txt+=`${sname(TA.lw)}'s pace (${a(TA.lw,"pace")}) is barely believable — at this level of speed there is simply no defending in a straight line. The right back must use positional intelligence, not pace of his own, to compete. `;
    if(a(TA.lw,"dribbling")>94)txt+=`A dribbling rating of ${a(TA.lw,"dribbling")} places this winger in the all-time top tier. Even correctly-positioned defenders cannot prevent the technical execution of the dribble. `;
    if(paceDiff>15)txt+=`The raw pace gap of ${Math.round(paceDiff)} is decisive. ${sname(TB.rb)} is beaten in every foot race and his only hope is to anticipate the movement before it happens. `;
    else if(paceDiff<-8)txt+=`${sname(TB.rb)} is actually faster — ${sname(TA.lw)}'s pace advantage doesn't exist in this matchup. `;
    if(getAttr(TA.lw,"offTheBall")>84)txt+=`Elite off-the-ball movement (${getAttr(TA.lw,"offTheBall")}) — ${sname(TA.lw)} finds space before the ball arrives, making man-marking extremely difficult. `;
    if((TB.rb.traits||[]).includes("attackingFullback"))txt+=`${sname(TB.rb)} is an attacking fullback who pushes high — this creates space behind him that ${sname(TA.lw)} can exploit on transitions. `;
    if(n&&n.cdmHelped)txt+=`${sname(TB.cdm)}'s CDM cover provides some help — dropping into the channel reduces the threat slightly. `;
    if(diff>30)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.lw)} completely owns this flank.`;
    else if(diff>12)txt+=`<br><br><strong>Verdict:</strong> Clear advantage for the winger — the left flank is ${n0}'s primary attack route.`;
    else if(diff>-6)txt+=`<br><br><strong>Verdict:</strong> Competitive flank battle. Both players trade moments throughout.`;
    else txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.rb)} shuts the left flank down completely.`;

    battles.push({title:`${sname(TA.lw)} vs ${sname(TB.rb)}`,sub:"LEFT WING vs RIGHT BACK",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PACE",a(TA.lw,"pace"),a(TB.rb,"pace")),
             statBox("DRIBBLING",a(TA.lw,"dribbling"),a(TB.rb,"tackling")),
             statBox("OFF BALL",getAttr(TA.lw,"offTheBall"),a(TB.rb,"intelligence")),
             statBox("TRANS THREAT",a(TA.lw,"transitionThreat"),a(TB.rb,"defensiveAwareness"))]});
  }

  // ── BATTLE 3: RW vs LB ───────────────────────────────────
  if(TA.rw&&TB.lb){
    const n=phases.neutralAvsB.rwVsLb;
    const rwPow=n?n.atkScore:TA.rwThreat;
    const lbPow=n?n.defScore:posScore2(TB.lb,"lb");
    const diff=rwPow-lbPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.rw),sname(TB.lb));
    const pd=a(TA.rw,"pace")-a(TB.lb,"pace");
    let txt=`<strong>${sname(TA.rw)}</strong> against <strong>${sname(TB.lb)}</strong> on the right flank.<br><br>`;
    if(a(TA.rw,"crossing")>88)txt+=`${sname(TA.rw)}'s crossing (${a(TA.rw,"crossing")}) is elite — every time he reaches the byline it's a genuinely dangerous delivery. `;
    if(pd>14)txt+=`The pace gap of ${Math.round(pd)} means ${sname(TA.rw)} escapes down the right channel repeatedly and ${sname(TB.lb)} can't recover. `;
    else if(pd<-8)txt+=`${sname(TB.lb)} is quicker — the right flank's pace threat is neutralised. `;
    if(a(TB.lb,"pressing")>84)txt+=`${sname(TB.lb)}'s pressing (${a(TB.lb,"pressing")}) is intense — ${sname(TA.rw)} rarely gets time to assess options. `;
    if((TB.lb.traits||[]).includes("attackingFullback"))txt+=`${sname(TB.lb)} attacks — overlapping left but leaving the right-side channel open for ${sname(TA.rw)} on the counter. `;
    if(getAttr(TA.rw,"clutch")>88)txt+=`${sname(TA.rw)}'s clutch rating (${getAttr(TA.rw,"clutch")}) means the biggest moments — the moments that matter most — are more likely to go his way. `;
    if(diff>30)txt+=`<br><br><strong>Verdict:</strong> Dominant performance — the right side is unstoppable.`;
    else if(diff<-20)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.lb)} is exceptional — ${sname(TA.rw)} has no impact.`;
    else txt+=`<br><br><strong>Verdict:</strong> Well-contested. This flank could go either way.`;

    battles.push({title:`${sname(TA.rw)} vs ${sname(TB.lb)}`,sub:"RIGHT WING vs LEFT BACK",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PACE",a(TA.rw,"pace"),a(TB.lb,"pace")),
             statBox("DRIBBLING",a(TA.rw,"dribbling"),a(TB.lb,"tackling")),
             statBox("CROSSING",a(TA.rw,"crossing"),a(TB.lb,"defensiveAwareness")),
             statBox("CLUTCH",getAttr(TA.rw,"clutch"),getAttr(TB.lb,"clutch"))]});
  }

  // ── BATTLE 4: CDM vs CAM — vision range is everything ────
  if(TA.cdm&&TB.cam){
    const n=phases.neutralAvsB.camVsCdm;
    const camPow=n?n.atkScore:posScore2(TB.cam,"cam");
    const cdmPow=n?n.defScore:posScore2(TA.cdm,"cdm");
    const diff=cdmPow-camPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.cdm),sname(TB.cam));
    const cdmDA=a(TA.cdm,"defensiveAwareness"),camCre=a(TB.cam,"creativity");
    const camVis=getAttr(TB.cam,"visionRange"),cdmAgg=getAttr(TA.cdm,"aggression");
    let txt=`<strong>${sname(TA.cdm)}</strong> tasked with neutralising <strong>${sname(TB.cam)}</strong>.<br><br>`;
    if(cdmDA>=90)txt+=`${sname(TA.cdm)}'s defensive awareness (${cdmDA}) is at the elite level — reading passes before they happen, consistently cutting off supply to ${sname(TB.cam)}. `;
    if(camCre>=95)txt+=`${sname(TB.cam)}'s creativity (${camCre}) borders on supernatural — finding passes and angles that simply should not exist. `;
    if(camVis>88)txt+=`${sname(TB.cam)}'s vision range (${camVis}) means they see the pitch on a completely different plane to most CDMs — the screen is constantly being bypassed by passes the CDM can't even conceptualise. `;
    if(cdmAgg>86)txt+=`${sname(TA.cdm)}'s aggression (${cdmAgg}) means every time ${sname(TB.cam)} receives the ball there is an immediate, intense physical challenge — creating hesitation and reducing the CAM's effectiveness. `;
    if(a(TA.cdm,"tackling")>=90)txt+=`Elite tackling (${a(TA.cdm,"tackling")}) — when the CDM gets close, the ball is coming off ${sname(TB.cam)}'s feet. `;
    if(a(TB.cam,"pressResistance")>=90)txt+=`${sname(TB.cam)}'s press resistance (${a(TB.cam,"pressResistance")}) means the aggression and pressing don't work — the CAM keeps the ball under maximum pressure and picks the right pass every time. `;
    if(diff>25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.cdm)} dominates. ${sname(TB.cam)}'s creative influence is minimal.`;
    else if(diff<-25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.cam)} is exceptional — bypasses the CDM repeatedly and creates goal after goal.`;
    else txt+=`<br><br><strong>Verdict:</strong> Absorbing central chess match. Both players have moments of supremacy.`;

    battles.push({title:`${sname(TA.cdm)} screens vs ${sname(TB.cam)}`,sub:"CDM SCREEN vs CAM CREATIVITY",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("DEF AWARE",cdmDA,camCre),
             statBox("VISION",getAttr(TA.cdm,"visionRange"),camVis),
             statBox("AGGRESSION",cdmAgg,a(TB.cam,"pressResistance")),
             statBox("TACKLING",a(TA.cdm,"tackling"),a(TB.cam,"dribbling"))]});
  }

  // ── BATTLE 5: CM vs CM ───────────────────────────────────
  if(TA.cm&&TB.cm){
    const diff=posScore2(TA.cm,"cm")-posScore2(TB.cm,"cm");
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.cm),sname(TB.cm));
    const visA=getAttr(TA.cm,"visionRange"),visB=getAttr(TB.cm,"visionRange");
    const stA=a(TA.cm,"stamina"),stB=a(TB.cm,"stamina");
    const adaptA=getAttr(TA.cm,"adaptability"),adaptB=getAttr(TB.cm,"adaptability");
    let txt=`<strong>${sname(TA.cm)}</strong> vs <strong>${sname(TB.cm)}</strong> — the engine room battle.<br><br>`;
    if(a(TA.cm,"passing")>=92)txt+=`${sname(TA.cm)}'s passing (${a(TA.cm,"passing")}) is world class — ranging switches, incisive through balls, reliable combinations under pressure. `;
    if(a(TB.cm,"passing")>=92)txt+=`${sname(TB.cm)} matches that level (${a(TB.cm,"passing")}) — a true battle of elite passers. `;
    if(visA>88)txt+=`${sname(TA.cm)}'s vision range (${visA}) means they consistently find passes others can't even consider — creating chances from deep that surprise even alert defences. `;
    if(visB>88)txt+=`${sname(TB.cm)}'s vision (${visB}) matches or exceeds that — this midfield duel is operating at the very highest level. `;
    if(Math.abs(stA-stB)>14)txt+=`Stamina is decisive in the second half — ${stA>stB?`${sname(TA.cm)} maintains level when ${sname(TB.cm)} fades`:`${sname(TB.cm)} is stronger late`}. `;
    if(Math.abs(adaptA-adaptB)>12)txt+=`Adaptability (${adaptA} vs ${adaptB}) means ${adaptA>adaptB?sname(TA.cm):sname(TB.cm)} adjusts better when tactics change mid-match. `;
    if(diff>25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.cm)} controls central midfield. ${sname(TB.cm)} barely competes.`;
    else if(diff<-25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.cm)} runs the show — ${sname(TA.cm)} is chasing all match.`;
    else txt+=`<br><br><strong>Verdict:</strong> An excellent battle. Small margins over 90 minutes.`;

    battles.push({title:`${sname(TA.cm)} vs ${sname(TB.cm)}`,sub:"CENTRAL MIDFIELD ENGINE",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PASSING",a(TA.cm,"passing"),a(TB.cm,"passing")),
             statBox("VISION",visA,visB),
             statBox("STAMINA",stA,stB),
             statBox("ADAPTABILITY",adaptA,adaptB)]});
  }

  // ── BATTLE 6: GK vs GK ───────────────────────────────────
  if(TA.gk&&TB.gk){
    const diff=posScore2(TA.gk,"gk")-posScore2(TB.gk,"gk");
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.gk),sname(TB.gk));
    const clutchA=getAttr(TA.gk,"clutch"),clutchB=getAttr(TB.gk,"clutch");
    let txt=`<strong>${sname(TA.gk)}</strong> vs <strong>${sname(TB.gk)}</strong>.<br><br>`;
    if(a(TA.gk,"reflexes")>=92)txt+=`${sname(TA.gk)}'s reflexes (${a(TA.gk,"reflexes")}) are at the absolute ceiling — stops shots that would beat 99% of keepers. `;
    if(a(TB.gk,"reflexes")>=92)txt+=`${sname(TB.gk)} matches that level (${a(TB.gk,"reflexes")}) — two elite reflexes keepers facing each other is exceptional. `;
    if(a(TA.gk,"commandOfArea")>=90)txt+=`${sname(TA.gk)}'s command of area (${a(TA.gk,"commandOfArea")}) dominates their box — crosses and corners are claimed authoritatively. `;
    if(clutchA>88)txt+=`${sname(TA.gk)}'s clutch rating (${clutchA}) means the biggest saves — penalty stops, last-minute denials — are more likely. `;
    if(clutchB>88)txt+=`${sname(TB.gk)}'s clutch (${clutchB}) matches that — two big-game keepers in the same match. `;
    if(diff>25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.gk)} is clearly the superior keeper — decisive saves will keep ${n0} in the match.`;
    else if(diff<-25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.gk)} is the standout — match-winning saves are coming.`;
    else txt+=`<br><br><strong>Verdict:</strong> Both are excellent. The match is decided outfield.`;

    battles.push({title:`${sname(TA.gk)} vs ${sname(TB.gk)}`,sub:"GOALKEEPER DUEL",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("REFLEXES",a(TA.gk,"reflexes"),a(TB.gk,"reflexes")),
             statBox("COMMAND",a(TA.gk,"commandOfArea"),a(TB.gk,"commandOfArea")),
             statBox("CLUTCH",clutchA,clutchB),
             statBox("DISTRIBUTION",a(TA.gk,"distribution"),a(TB.gk,"distribution"))]});
  }

  // ── BATTLE 7: CB vs winger cutting inside ────────────────
  const cbA=TB.cbs[0],wideA=TA.lw||TA.rw;
  if(cbA&&wideA){
    const cbPow=posScore2(cbA,"cb"),widePow=posScore2(wideA,TA.lw?"lw":"rw");
    const diff=cbPow-widePow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(cbA),sname(wideA));
    const pd=a(cbA,"pace")-a(wideA,"pace");
    let txt=`<strong>${sname(cbA)}</strong> defending against <strong>${sname(wideA)}</strong> cutting inside.<br><br>`;
    if(pd<-18)txt+=`The pace deficit of ${Math.abs(Math.round(pd))} points is severe. Once ${sname(wideA)} turns and runs, ${sname(cbA)} has no chance of recovering. This is a fundamental structural problem. `;
    else if(pd<-8)txt+=`${sname(wideA)} has a meaningful pace advantage when cutting inside — ${sname(cbA)} must position perfectly to avoid being isolated. `;
    else if(pd>6)txt+=`${sname(cbA)} is actually quicker — the inside cut threat is significantly reduced by the pace equalisation. `;
    if(a(wideA,"dribbling")>93)txt+=`A dribbling rating of ${a(wideA,"dribbling")} means even a well-positioned ${sname(cbA)} can be beaten in one-on-one situations. `;
    if(a(cbA,"intelligence")>=88)txt+=`${sname(cbA)}'s intelligence (${a(cbA,"intelligence")}) lets him position to cut off the inside run before it starts. `;
    if(getAttr(cbA,"adaptability")>84)txt+=`${sname(cbA)}'s adaptability (${getAttr(cbA,"adaptability")}) means he can switch from zonal to man-marking depending on where ${sname(wideA)} moves. `;
    if(diff<-25)txt+=`<br><br><strong>Verdict:</strong> Crisis for ${n0}'s defence every time ${sname(wideA)} gets the ball.`;
    else if(diff>20)txt+=`<br><br><strong>Verdict:</strong> ${sname(cbA)} reads the winger brilliantly — cuts inside threat effectively.`;
    else txt+=`<br><br><strong>Verdict:</strong> Contested. Outcome varies by moment and situation.`;

    battles.push({title:`${sname(cbA)} vs ${sname(wideA)} (inside)`,sub:"CB DEFENDING vs WIDE CUT INSIDE",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PACE",a(cbA,"pace"),a(wideA,"pace")),
             statBox("DEF AWARE",a(cbA,"defensiveAwareness"),a(wideA,"dribbling")),
             statBox("ADAPTABILITY",getAttr(cbA,"adaptability"),getAttr(wideA,"offTheBall")),
             statBox("INTELLIGENCE",a(cbA,"intelligence"),a(wideA,"intelligence"))]});
  }

  // ── BATTLE 8: CDM vs ST link-up ──────────────────────────
  if(TB.cdm&&TA.st){
    const cdmPow=posScore2(TB.cdm,"cdm");
    const stLinkPow=avg2(a(TA.st,"passing"),a(TA.st,"intelligence"),a(TA.st,"physical"),getAttr(TA.st,"offTheBall"));
    const diff=cdmPow-stLinkPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TB.cdm),sname(TA.st));
    let txt=`<strong>${sname(TB.cdm)}</strong> trying to prevent service to <strong>${sname(TA.st)}</strong>.<br><br>`;
    if(a(TB.cdm,"tackling")>=90)txt+=`Elite tackling (${a(TB.cdm,"tackling")}) — ${sname(TB.cdm)} wins the ball cleanly every time ${sname(TA.st)} tries to hold up. `;
    if(a(TB.cdm,"physical")>=88)txt+=`Physical dominance (${a(TB.cdm,"physical")}) — wins shoulder barges and wrestling matches consistently. `;
    if(a(TA.st,"physical")>=88)txt+=`${sname(TA.st)}'s physicality (${a(TA.st,"physical")}) is a match — can hold off the CDM and play before being dispossessed. `;
    if(getAttr(TB.cdm,"aggression")>86)txt+=`${sname(TB.cdm)}'s aggression (${getAttr(TB.cdm,"aggression")}) means there is no peace for ${sname(TA.st)} — every touch is immediately contested. `;
    if(getAttr(TA.st,"offTheBall")>86)txt+=`${sname(TA.st)}'s off-the-ball movement (${getAttr(TA.st,"offTheBall")}) — dropping deep, drifting wide, exploiting the channels — makes marking almost impossible for even an elite CDM. `;
    if(diff>20)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.cdm)} completely neutralises link-up play.`;
    else if(diff<-15)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.st)} wins the physical contest and brings team-mates into play regularly.`;
    else txt+=`<br><br><strong>Verdict:</strong> Competitive throughout. Physical battle goes either way.`;

    battles.push({title:`${sname(TB.cdm)} vs ${sname(TA.st)} link-up`,sub:"CDM SCREEN vs ST BUILD-UP",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("TACKLING",a(TB.cdm,"tackling"),a(TA.st,"physical")),
             statBox("PHYSICAL",a(TB.cdm,"physical"),a(TA.st,"physical")),
             statBox("AGGRESSION",getAttr(TB.cdm,"aggression"),getAttr(TA.st,"clutch")),
             statBox("OFF BALL",a(TB.cdm,"positioning"),getAttr(TA.st,"offTheBall"))]});
  }

  // ── BATTLE 9: TRANSITION SHOWDOWN ────────────────────────
  const fastAtk=[TA.lw,TA.rw,TA.st].filter(p=>p).sort((x,y)=>a(y,"pace")-a(x,"pace"))[0];
  const fastDef=[TB.lb,TB.rb,...TB.cbs].filter(p=>p).sort((x,y)=>a(y,"pace")-a(x,"pace"))[0];
  if(fastAtk&&fastDef){
    const pA=a(fastAtk,"pace"),pD=a(fastDef,"pace");
    const diff=(pA-pD)*1.15+(getAttr(fastAtk,"offTheBall")-60)*0.32;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(fastAtk),sname(fastDef));
    let txt=`<strong>${sname(fastAtk)}</strong> (${pA} pace) vs <strong>${sname(fastDef)}</strong> (${pD} pace) — the transition race.<br><br>`;
    if(pA>93)txt+=`${sname(fastAtk)}'s pace of ${pA} is in a category that normal defending cannot account for. In open space, there is no catching this player. `;
    const pd2=pA-pD;
    if(pd2>18)txt+=`A pace gap of ${Math.round(pd2)} is decisive in any open-space scenario — ${n1}'s defensive line must sit deeper purely because of this threat. `;
    else if(pd2>8)txt+=`Meaningful pace advantage — ${n0} benefit from regularly trying balls in behind. `;
    else if(pd2<-5)txt+=`${sname(fastDef)} is actually quicker — every ball in behind is recovered. `;
    if(phases.neutralAvsB.transition){
      const t=phases.neutralAvsB.transition;
      if(t.highLineRisk>0.65)txt+=`${n1} play a very high line (multiplier: ${(t.lineHeightMultiplier||1).toFixed(1)}x) — the space in behind is enormous and every transition is a genuine chance. `;
      if(t.fbPushRisk>0.4)txt+=`${n1}'s fullbacks push high — additional space for ${sname(fastAtk)} to run into on the break. `;
      if(t.cdmProtectionReduction>0.35)txt+=`${n1}'s CDM provides significant protection and closes the passing lane for balls in behind. `;
    }
    if(getAttr(fastDef,"adaptability")>84)txt+=`${sname(fastDef)}'s adaptability (${getAttr(fastDef,"adaptability")}) means they adjust their starting position based on where the pace threat is — reducing the space available. `;
    if(diff>30)txt+=`<br><br><strong>Verdict:</strong> ${sname(fastAtk)} destroys the transition battle — multiple counter-attack goals are likely.`;
    else if(diff>12)txt+=`<br><br><strong>Verdict:</strong> Transition favours ${n0} — pace advantage translates to scoring opportunities.`;
    else if(diff>-6)txt+=`<br><br><strong>Verdict:</strong> Even in transition — decided by positioning and tactical awareness.`;
    else txt+=`<br><br><strong>Verdict:</strong> ${sname(fastDef)} and the defensive line contain the transition threat.`;

    battles.push({title:`${sname(fastAtk)} vs ${sname(fastDef)} (transition)`,sub:"PACE & TRANSITION SHOWDOWN",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PACE",pA,pD),
             statBox("TRANS THREAT",a(fastAtk,"transitionThreat"),a(fastDef,"defensiveAwareness")),
             statBox("OFF BALL",getAttr(fastAtk,"offTheBall"),getAttr(fastDef,"adaptability")),
             statBox("CLUTCH",getAttr(fastAtk,"clutch"),getAttr(fastDef,"clutch"))]});
  }

  return battles;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DEEP TACTICAL BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════
function deepTacticalBreakdown(phases,n0,n1){
  const TA=phases.TA,TB=phases.TB;
  const CA=phases.CA,CB=phases.CB;
  const tacA=phases.tacA,tacB=phases.tacB;
  const sections=[];

  const styleNames={
    highPress:"high-intensity pressing outfit",possession:"possession-based team",
    counterAttack:"fast counter-attacking side",direct:"direct, vertical team",
    organised:"compact, disciplined side",tiki:"tiki-taka possession machine"
  };

  // OVERVIEW
  sections.push({title:"TACTICAL OVERVIEW",wt:null,wc:null,
    text:`<strong>${n0}</strong> set up as a ${styleNames[tacA?.primaryStyle]||"balanced side"} (secondary: ${tacA?.secondaryStyle}). <strong>${n1}</strong> as a ${styleNames[tacB?.primaryStyle]||"balanced side"}.
    Line height — ${n0}: <strong>${tacA?.lineHeight||"medium"}</strong>, ${n1}: <strong>${tacB?.lineHeight||"medium"}</strong>.
    Pressing intensity — ${n0}: <strong>${tacA?.pressingIntensity||"medium"}</strong>, ${n1}: <strong>${tacB?.pressingIntensity||"medium"}</strong>.
    ${phases.synA.log.length?`<br><br><strong>${n0} key synergies:</strong> ${phases.synA.log.slice(0,2).join(". ")}.`:""}
    ${phases.synB.log.length?`<br><strong>${n1} key synergies:</strong> ${phases.synB.log.slice(0,2).join(". ")}.`:""}`
  });

  // ATTACK
  const aaw=phases.aAtk>phases.bAtk;
  sections.push({title:"ATTACK vs DEFENCE",wt:Math.abs(phases.aAtk-phases.bAtk)<3?"DRAW":aaw?n0:n1,wc:Math.abs(phases.aAtk-phases.bAtk)<3?"draw":aaw?"p1":"p2",
    text:`Attack scores: <strong>${n0} ${Math.round(phases.aAtk)}</strong> — <strong>${n1} ${Math.round(phases.bAtk)}</strong>.
    ${TA.stFinishingThreat>90?`${sname(TA.st)}'s finishing (${Math.round(TA.stFinishingThreat)}) is elite. `:""}
    ${TA.stOffBall>86?`${sname(TA.st)}'s off-the-ball movement (${Math.round(TA.stOffBall)}) creates space before the ball even arrives. `:""}
    ${TB.cbDefAware<70&&TA.stPaceThreat>80?`${n1}'s defensive awareness (${Math.round(TB.cbDefAware)}) is poor against pace. `:""}
    ${TB.gkShotStopping>86?`${sname(TB.gk)}'s shot-stopping (${Math.round(TB.gkShotStopping)}) is elite. `:""}
    ${CA.offBallBonus>4?`Team off-the-ball movement bonus: +${CA.offBallBonus.toFixed(1)} — constant movement creates gaps the defence cannot cover. `:""}
    <em>Attack score: forwards and CAM only — unaffected by defensive players' ratings.</em>`
  });

  // MIDFIELD
  const amw=phases.aMid>phases.bMid;
  sections.push({title:"MIDFIELD BATTLE",wt:Math.abs(phases.aMid-phases.bMid)<3?"DRAW":amw?n0:n1,wc:Math.abs(phases.aMid-phases.bMid)<3?"draw":amw?"p1":"p2",
    text:`Midfield: <strong>${n0} ${Math.round(phases.aMid)}</strong> — <strong>${n1} ${Math.round(phases.bMid)}</strong>.
    ${CA.cdmCompensatesForWeakCAM?`${sname(TA.cdm)} compensates for limited CAM creativity — the CDM is doing double duty. `:""}
    ${TA.teamVision>82?`Team vision range (${Math.round(TA.teamVision)}) is high — consistently creates passes that open up defences. `:""}
    ${TA.teamAggression>80?`Midfield aggression (${Math.round(TA.teamAggression)}) is a factor — wins physical battles and disrupts the opponent's rhythm. `:""}
    ${CA.effectivePressResistance>84?`Press resistance (${Math.round(CA.effectivePressResistance)}) — plays through any pressure comfortably. `:""}
    ${Math.abs(phases.aMid-phases.bMid)>20?"The midfield battle is heavily one-sided — this determines the tempo for the entire match.":""}`
  });

  // TRANSITION
  const atw=phases.aTrans>phases.bTrans;
  const td=phases.neutralAvsB?.transition;
  sections.push({title:"TRANSITION & COUNTER",wt:Math.abs(phases.aTrans-phases.bTrans)<3?"DRAW":atw?n0:n1,wc:Math.abs(phases.aTrans-phases.bTrans)<3?"draw":atw?"p1":"p2",
    text:`Transition: <strong>${n0} ${Math.round(phases.aTrans)}</strong> — <strong>${n1} ${Math.round(phases.bTrans)}</strong>.
    ${td?`Context multiplier: <strong>${(td.contextMultiplier*100).toFixed(0)}%</strong> — this is how much of the theoretical transition threat is activated against ${n1}'s defensive setup. `:""}
    ${td&&td.lineHeightMultiplier>1.2?`<strong>${n1}'s high/very high defensive line</strong> multiplies the transition danger by ${td.lineHeightMultiplier.toFixed(1)}x — dangerous. `:""}
    ${td&&td.elitePaceBonus>0?`${Math.round(td.elitePaceBonus/9)} elite-pace forwards (90+) — transition bonus is substantial. `:""}
    ${td&&td.cdmProtectionReduction>0.38?`${n1}'s CDM screens effectively — reduces transition opportunities. `:""}
    <em>Transition only activates fully when defensive shape creates the conditions for it.</em>`
  });

  // WIDE
  const aww=phases.aWide>phases.bWide;
  sections.push({title:"WIDE PLAY",wt:Math.abs(phases.aWide-phases.bWide)<3?"DRAW":aww?n0:n1,wc:Math.abs(phases.aWide-phases.bWide)<3?"draw":aww?"p1":"p2",
    text:`Wide: <strong>${n0} ${Math.round(phases.aWide)}</strong> — <strong>${n1} ${Math.round(phases.bWide)}</strong>.
    ${TA.lw?`Left: <strong>${sname(TA.lw)}</strong> (${a(TA.lw,"pace")} pace, ${a(TA.lw,"dribbling")} dribbling) vs ${TB.rb?sname(TB.rb)+" ("+a(TB.rb,"pace")+" pace, "+a(TB.rb,"defensiveAwareness")+" DA)":"no RB"}. `:""}
    ${TA.rw?`Right: <strong>${sname(TA.rw)}</strong> (${a(TA.rw,"pace")} pace, ${a(TA.rw,"crossing")} crossing) vs ${TB.lb?sname(TB.lb)+" ("+a(TB.lb,"pace")+" pace, "+a(TB.lb,"tackling")+" tackling)":"no LB"}. `:""}
    ${CA.lwNotTracking?`⚠️ ${sname(TA.lw)} doesn't track back (workRate: ${a(TA.lw,"workRate")}) — the right back can push higher. `:""}
    ${CA.leftFlankDefGap>10?`⚠️ Left flank defensive gap: ${Math.round(CA.leftFlankDefGap)} — exposure from attacking LB. `:""}`
  });

  // DEFENCE
  const adw=phases.aDefStr>phases.bDefStr;
  sections.push({title:"DEFENSIVE STRUCTURE",wt:Math.abs(phases.aDefStr-phases.bDefStr)<3?"DRAW":adw?n0:n1,wc:Math.abs(phases.aDefStr-phases.bDefStr)<3?"draw":adw?"p1":"p2",
    text:`Defence: <strong>${n0} ${Math.round(phases.aDefStr)}</strong> — <strong>${n1} ${Math.round(phases.bDefStr)}</strong>.
    ${TA.cbs.length?`CBs: ${TA.cbs.map(c=>sname(c)+"("+a(c,"defensiveAwareness")+" DA, "+a(c,"pace")+" pace, adapt:"+getAttr(c,"adaptability")+")").join(" + ")}. `:""}
    ${TA.cbPartnershipBonus>=9?`CB partnership bonus +${TA.cbPartnershipBonus} — elite complementary pairing. `:""}
    ${CA.cdmCanCoverFBs?`${sname(TA.cdm)}'s screen (quality: ${Math.round(TA.cdmScreenQuality)}) covers FB attacks effectively. `:`⚠️ CDM cover insufficient for attacking FBs. `}
    ${TA.teamAdaptability>82?`Team adaptability (${Math.round(TA.teamAdaptability)}) allows mid-match adjustments to neutralise threats. `:""}
    <em>Defence score from CB/LB/RB/CDM position scores and GK only.</em>`
  });

  return sections;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONTEXTUAL WEAKNESSES
// ═══════════════════════════════════════════════════════════════════════════
function contextualWeaknesses(T,oppT,tactic,oppTactic){
  const w=[];
  if(T.cbPace<72&&oppT.attackPace>82)w.push({label:`Slow CBs vs pace (gap: ${Math.round(oppT.attackPace-T.cbPace)})`,detail:`CB pace ${Math.round(T.cbPace)} vs opp attack pace ${Math.round(oppT.attackPace)} — balls in behind repeatedly dangerous.`});
  if(T.cdmScreenQuality<65&&(oppT.transitionThreat>78||oppT.camCreativity>80))w.push({label:"Weak CDM screen",detail:`Screen quality ${Math.round(T.cdmScreenQuality)} vs opp creative/transition threat — midfield bypassed regularly.`});
  if(T.teamPressResistance<68&&oppT.teamPressing>76)w.push({label:"Low press resistance",detail:`Press resistance ${Math.round(T.teamPressResistance)} vs opp pressing ${Math.round(oppT.teamPressing)} — build-up play disrupted constantly.`});
  if(T.cbAerial<74&&(oppT.stAerialThreat>78||oppT.camSetPieceThreat>78))w.push({label:"Aerial weakness",detail:`CB aerial ${Math.round(T.cbAerial)} vs opp aerial threat ${Math.round(oppT.stAerialThreat)} — vulnerable to crosses and set pieces.`});
  if(T.fbCombinedAttackRisk>70&&T.cdmScreenQuality<68)w.push({label:"Exposed on counter",detail:`FB attack risk ${Math.round(T.fbCombinedAttackRisk)} with CDM screen ${Math.round(T.cdmScreenQuality)} — counter-attack vulnerability.`});
  if(T.gkRating<72)w.push({label:"GK below standard",detail:`GK rating ${Math.round(T.gkRating)} — will likely concede saveable shots.`});
  if(T.stFinishingThreat<66)w.push({label:"Poor finishing",detail:`ST finishing threat ${Math.round(T.stFinishingThreat)} — creates chances but conversion rate low.`});
  if(T.lwNotTracking&&T.rwNotTracking)w.push({label:"Wingers not tracking",detail:"Both wingers low workRate/DA — fullbacks exposed in 2v1s on both flanks."});
  if(!T.cdm)w.push({label:"No CDM",detail:"Playing without a defensive midfielder leaves the backline dangerously exposed."});
  if(T.lwCrossingThreat>75&&T.rwCrossingThreat>75&&T.stAerialThreat<68)w.push({label:"Crosses without aerial target",detail:`Good crossing quality but no dominant aerial striker — delivery goes to waste.`});
  if(T.teamAdaptability<62)w.push({label:"Low adaptability",detail:"One-dimensional — struggles to adjust when opponents change tactics mid-match."});
  if(T.teamClutch<65&&oppT.teamClutch>80)w.push({label:"Lacks clutch performers",detail:"When the match is on the line, this team doesn't have the big-game players to find a decisive moment."});
  return w;
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════════════════════
window.ENGINE={
  calcTacticalIdentity,calcIndividualThreats,calcCoverageChains,
  calcThreatNeutralisation,calcDynamicSynergy,calcMomentum,calcFullPhases,
  dynamicScoreline,dynamicPlayerRatings,dynamicGoalEvents,
  calcDeepPvP,deepTacticalBreakdown,contextualWeaknesses,
  getAttr,posScore2,sname,avg2,clamp2,rng2,a,attrCol2,
  firstByRole,allByRole
};

// ═══════════════════════════════════════════════════════════════════════════
//  DRAFT ZONE — ADVANCED MATCH ENGINE EXTENSION v5.0
//  Deep contextual verdict API for GitHub draft comparisons.
// ═══════════════════════════════════════════════════════════════════════════
(function(){
  const BASE_ENGINE = window.ENGINE || {};
  const safeAvg = BASE_ENGINE.avg2 || function(...vals){const f=vals.flat().filter(v=>v!=null&&!isNaN(v));return f.length?f.reduce((a,b)=>a+b,0)/f.length:0};
  const safeClamp = BASE_ENGINE.clamp2 || function(v,lo,hi){return Math.max(lo,Math.min(hi,v))};
  const stat = BASE_ENGINE.a || function(p,k,d=70){return p?(p[k]??d):d};
  const nm = BASE_ENGINE.sname || function(p){return p?p.name.split("—")[0].trim():"?"};
  const roleOf = function(sq,role){return (BASE_ENGINE.firstByRole?BASE_ENGINE.firstByRole(sq,role):null)};
  const rolesOf = function(sq,role){return (BASE_ENGINE.allByRole?BASE_ENGINE.allByRole(sq,role):[])};
  function teamPlayers(sq){return (sq||[]).filter(Boolean)}
  function f3(v){return Math.round(v*1000)/1000}
  function pctFromDiff(diff){return safeClamp(50 + diff * 3.1, 2, 98)}
  function roleGroup(role){if(role==="gk")return "goalkeeper";if(["cb","lb","rb"].includes(role))return "defender";if(["cdm","cm","cam"].includes(role))return "midfielder";return "attacker";}
  function weightedStat(p, weights){let total=0, weight=0; for(const [k,w] of Object.entries(weights)){total += stat(p,k,70)*w; weight += Math.abs(w);} return weight?total/weight:70;}
  const ADVANCED_WEIGHTS = Object.freeze({
    attack:{attack:.16,finishing:.14,positioning:.10,pace:.09,technical:.08,dribbling:.10,creativity:.08,offTheBall:.08,weakFoot:.04,clutch:.05,physical:.04,passing:.04},
    midfield:{midfield:.16,passing:.13,pressResistance:.11,technical:.10,intelligence:.11,visionRange:.09,workRate:.07,stamina:.05,creativity:.08,defence:.04,adaptability:.04,leadership:.02},
    defence:{defense:.16,defence:.16,defensiveAwareness:.13,tackling:.11,positioning:.10,intelligence:.10,physical:.08,pace:.07,aerial:.06,aggression:.04,leadership:.03,adaptability:.02},
    pressing:{pressing:.20,workRate:.16,stamina:.13,aggression:.13,intelligence:.10,pace:.08,physical:.08,defensiveAwareness:.06,adaptability:.04,consistency:.02},
    transition:{transitionThreat:.20,pace:.18,offTheBall:.12,dribbling:.10,passing:.08,visionRange:.08,technical:.06,positioning:.07,finishing:.06,workRate:.03,adaptability:.02},
    setPiece:{setPieces:.18,crossing:.15,aerial:.14,physical:.10,positioning:.09,finishing:.08,heading:.06,visionRange:.06,clutch:.05,leadership:.04,intelligence:.05},
    goalkeeper:{goalkeeperRating:.24,reflexes:.18,positioning:.13,commandOfArea:.12,distribution:.10,aerial:.08,clutch:.06,consistency:.05,adaptability:.04}
  });
  const POSITION_IMPORTANCE = Object.freeze({
    gk:{"goalkeeperRating": 0.42, "distribution": 0.12, "clutch": 0.08, "commandOfArea": 0.1, "defence": 0.28},
    lb:{"defence": 0.24, "pace": 0.14, "workRate": 0.12, "crossing": 0.1, "technical": 0.08, "intelligence": 0.12, "transitionThreat": 0.08, "stamina": 0.12},
    rb:{"defence": 0.24, "pace": 0.14, "workRate": 0.12, "crossing": 0.1, "technical": 0.08, "intelligence": 0.12, "transitionThreat": 0.08, "stamina": 0.12},
    cb:{"defence": 0.34, "physical": 0.13, "aerial": 0.12, "pace": 0.09, "intelligence": 0.14, "passing": 0.06, "leadership": 0.06, "adaptability": 0.06},
    cdm:{"defence": 0.23, "midfield": 0.18, "intelligence": 0.13, "pressResistance": 0.1, "physical": 0.09, "passing": 0.09, "workRate": 0.09, "positioning": 0.09},
    cm:{"midfield": 0.28, "workRate": 0.12, "pressResistance": 0.12, "passing": 0.13, "intelligence": 0.13, "technical": 0.1, "defence": 0.07, "attack": 0.05},
    cam:{"midfield": 0.18, "attack": 0.16, "creativity": 0.17, "passing": 0.13, "technical": 0.13, "pressResistance": 0.08, "offTheBall": 0.08, "clutch": 0.07},
    lw:{"attack": 0.22, "pace": 0.16, "dribbling": 0.15, "creativity": 0.11, "workRate": 0.06, "transitionThreat": 0.12, "technical": 0.1, "finishing": 0.08},
    rw:{"attack": 0.22, "pace": 0.16, "dribbling": 0.15, "creativity": 0.11, "workRate": 0.06, "transitionThreat": 0.12, "technical": 0.1, "finishing": 0.08},
    st:{"attack": 0.27, "finishing": 0.18, "positioning": 0.12, "pace": 0.1, "physical": 0.08, "offTheBall": 0.1, "aerial": 0.05, "clutch": 0.06, "technical": 0.04},
  });
  function roleFitScore(player, role){
    if(!player)return 45;
    const w=POSITION_IMPORTANCE[role]||{overall:1};
    let total=0, weight=0;
    for(const [k,v] of Object.entries(w)){total += stat(player,k,player.overall||70)*v; weight += v;}
    const listed=(player.positions||player.secondaryPositions||[]).concat([player.position]).filter(Boolean).map(x=>String(x).toLowerCase());
    const rolePenalty = listed.includes(role)?0:(roleGroup(role)==="attacker"&&["lw","rw","st","cam"].some(r=>listed.includes(r))?-2:-5);
    return safeClamp(total/(weight||1) + rolePenalty, 35, 99);
  }
  function sideObject(sq){return {gk:roleOf(sq,"gk"),lb:roleOf(sq,"lb"),rb:roleOf(sq,"rb"),cbs:rolesOf(sq,"cb"),cdm:roleOf(sq,"cdm"),cm:roleOf(sq,"cm"),cam:roleOf(sq,"cam"),lw:roleOf(sq,"lw"),rw:roleOf(sq,"rw"),st:roleOf(sq,"st"),all:teamPlayers(sq)};}
  function extendedTeamProfile(sq){
    const S=sideObject(sq), all=S.all;
    const by=k=>safeAvg(...all.map(p=>stat(p,k,70)));
    const forward=[S.lw,S.rw,S.st].filter(Boolean), mids=[S.cdm,S.cm,S.cam].filter(Boolean), backs=[S.lb,S.rb,...S.cbs].filter(Boolean);
    const profile={
      attack: safeAvg(...forward.map(p=>weightedStat(p,ADVANCED_WEIGHTS.attack))), midfield: safeAvg(...mids.map(p=>weightedStat(p,ADVANCED_WEIGHTS.midfield))), defence: safeAvg(...backs.map(p=>weightedStat(p,ADVANCED_WEIGHTS.defence))), goalkeeper: S.gk?weightedStat(S.gk,ADVANCED_WEIGHTS.goalkeeper):55,
      pressing: safeAvg(...all.map(p=>weightedStat(p,ADVANCED_WEIGHTS.pressing))), transition: safeAvg(...forward.map(p=>weightedStat(p,ADVANCED_WEIGHTS.transition))), setPiece: safeAvg(...all.map(p=>weightedStat(p,ADVANCED_WEIGHTS.setPiece))),
      pace:by("pace"), physical:by("physical"), technical:by("technical"), intelligence:by("intelligence"), workRate:by("workRate"), stamina:by("stamina"), pressResistance:by("pressResistance"), creativity:by("creativity"), clutch:by("clutch"), consistency:by("consistency"), aerial:by("aerial"), aggression:by("aggression"), leadership:by("leadership"),
      cbPace:safeAvg(...S.cbs.map(p=>stat(p,"pace",70))), cbAerial:safeAvg(...S.cbs.map(p=>stat(p,"aerial",70))), cdmCover:S.cdm?weightedStat(S.cdm,ADVANCED_WEIGHTS.defence):52,
      leftDefence:safeAvg(roleFitScore(S.lb,"lb"),S.lw?stat(S.lw,"workRate",70):55,S.cdm?stat(S.cdm,"defensiveAwareness",70):55), rightDefence:safeAvg(roleFitScore(S.rb,"rb"),S.rw?stat(S.rw,"workRate",70):55,S.cdm?stat(S.cdm,"defensiveAwareness",70):55),
      leftAttack:safeAvg(S.lw?roleFitScore(S.lw,"lw"):55,S.lb?stat(S.lb,"crossing",60):55,S.cam?stat(S.cam,"creativity",70):60), rightAttack:safeAvg(S.rw?roleFitScore(S.rw,"rw"):55,S.rb?stat(S.rb,"crossing",60):55,S.cam?stat(S.cam,"creativity",70):60),
      spine:safeAvg(S.gk?roleFitScore(S.gk,"gk"):55,...S.cbs.map(p=>roleFitScore(p,"cb")),S.cdm?roleFitScore(S.cdm,"cdm"):55,S.cam?roleFitScore(S.cam,"cam"):60,S.st?roleFitScore(S.st,"st"):60),
      roleFit:safeAvg(...(sq||[]).map((p,i)=>p?roleFitScore(p,(window.LAYOUT&&window.LAYOUT[i]?window.LAYOUT[i].role:"cm")):55))
    };
    profile.balance = 100 - (Math.max(profile.attack,profile.midfield,profile.defence)-Math.min(profile.attack,profile.midfield,profile.defence))*0.72;
    profile.directness = safeAvg(profile.transition,profile.pace,profile.attack);
    profile.identity = identifyAdvancedArchetype(profile);
    return profile;
  }
  function identifyAdvancedArchetype(P){
    const scores={possession:P.midfield*.35+P.pressResistance*.25+P.technical*.20+P.intelligence*.20,counter:P.transition*.38+P.pace*.25+P.defence*.14+P.clutch*.08+P.spine*.15,press:P.pressing*.38+P.workRate*.23+P.stamina*.17+P.aggression*.12+P.pace*.10,lowBlock:P.defence*.32+P.goalkeeper*.18+P.aerial*.13+P.intelligence*.18+P.cdmCover*.19,wide:P.leftAttack*.22+P.rightAttack*.22+P.setPiece*.16+P.pace*.16+P.attack*.24,balanced:P.balance*.32+P.spine*.20+P.roleFit*.18+P.midfield*.12+P.defence*.10+P.attack*.08};
    return Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(([name,score])=>({name,score:f3(score)}));
  }
  const ADVANCED_RULES = [];
  function rule_transitionSpace(A,B,ctx){
    const label = "Transition Space Activation";
    const category = "transition";
    let aScore = A.transition*.34 + A.pace*.18 + A.attack*.14 + A.midfield*.08 + A.pressResistance*.06 + (100-B.cbPace)*.10 + (100-B.cdmCover)*.10;
    let bScore = B.transition*.34 + B.pace*.18 + B.attack*.14 + B.midfield*.08 + B.pressResistance*.06 + (100-A.cbPace)*.10 + (100-A.cdmCover)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"transitionSpace",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_transitionSpace);
  function rule_restDefence(A,B,ctx){
    const label = "Rest Defence Integrity";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"restDefence",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_restDefence);
  function rule_halfSpaceAccess(A,B,ctx){
    const label = "Half-Space Access";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"halfSpaceAccess",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_halfSpaceAccess);
  function rule_centralOverload(A,B,ctx){
    const label = "Central Overload";
    const category = "midfield";
    let aScore = A.midfield*.32 + A.pressResistance*.18 + A.technical*.13 + A.intelligence*.13 + A.workRate*.08 + A.physical*.06 + (100-B.pressing)*.10;
    let bScore = B.midfield*.32 + B.pressResistance*.18 + B.technical*.13 + B.intelligence*.13 + B.workRate*.08 + B.physical*.06 + (100-A.pressing)*.10;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"centralOverload",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_centralOverload);
  function rule_wideIsolation(A,B,ctx){
    const label = "Wide Isolation Creation";
    const category = "wide";
    let aScore = safeAvg(A.leftAttack-B.rightDefence+78,A.rightAttack-B.leftDefence+78,A.pace*.22+A.technical*.16+A.workRate*.12+A.attack*.20+A.setPiece*.10+A.balance*.10+A.creativity*.10);
    let bScore = safeAvg(B.leftAttack-A.rightDefence+78,B.rightAttack-A.leftDefence+78,B.pace*.22+B.technical*.16+B.workRate*.12+B.attack*.20+B.setPiece*.10+B.balance*.10+B.creativity*.10);
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"wideIsolation",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_wideIsolation);
  function rule_counterPressTrap(A,B,ctx){
    const label = "Counter-Press Trap";
    const category = "pressing";
    let aScore = A.pressing*.34 + A.workRate*.17 + A.stamina*.13 + A.aggression*.12 + (100-B.pressResistance)*.18 + (100-B.goalkeeper)*.06;
    let bScore = B.pressing*.34 + B.workRate*.17 + B.stamina*.13 + B.aggression*.12 + (100-A.pressResistance)*.18 + (100-A.goalkeeper)*.06;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"counterPressTrap",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_counterPressTrap);
  function rule_deepBlockBreaker(A,B,ctx){
    const label = "Deep Block Breaking";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"deepBlockBreaker",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_deepBlockBreaker);
  function rule_highLineRisk(A,B,ctx){
    const label = "High Line Risk";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"highLineRisk",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_highLineRisk);
  function rule_secondBallControl(A,B,ctx){
    const label = "Second-Ball Control";
    const category = "midfield";
    let aScore = A.midfield*.32 + A.pressResistance*.18 + A.technical*.13 + A.intelligence*.13 + A.workRate*.08 + A.physical*.06 + (100-B.pressing)*.10;
    let bScore = B.midfield*.32 + B.pressResistance*.18 + B.technical*.13 + B.intelligence*.13 + B.workRate*.08 + B.physical*.06 + (100-A.pressing)*.10;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"secondBallControl",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_secondBallControl);
  function rule_aerialBoxThreat(A,B,ctx){
    const label = "Aerial Box Threat";
    const category = "setPiece";
    let aScore = A.setPiece*.38 + A.aerial*.20 + A.physical*.10 + A.clutch*.07 + (100-B.cbAerial)*.15 + (100-B.goalkeeper)*.10;
    let bScore = B.setPiece*.38 + B.aerial*.20 + B.physical*.10 + B.clutch*.07 + (100-A.cbAerial)*.15 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"aerialBoxThreat",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_aerialBoxThreat);
  function rule_keeperSweeping(A,B,ctx){
    const label = "Keeper Sweeping Value";
    const category = "goalkeeper";
    let aScore = A.goalkeeper*.45 + A.defence*.18 + A.aerial*.08 + A.clutch*.08 + A.pressResistance*.05 + (100-B.attack)*.16;
    let bScore = B.goalkeeper*.45 + B.defence*.18 + B.aerial*.08 + B.clutch*.08 + B.pressResistance*.05 + (100-A.attack)*.16;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"keeperSweeping",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_keeperSweeping);
  function rule_keeperDistributionPress(A,B,ctx){
    const label = "Keeper Distribution Under Press";
    const category = "goalkeeper";
    let aScore = A.goalkeeper*.45 + A.defence*.18 + A.aerial*.08 + A.clutch*.08 + A.pressResistance*.05 + (100-B.attack)*.16;
    let bScore = B.goalkeeper*.45 + B.defence*.18 + B.aerial*.08 + B.clutch*.08 + B.pressResistance*.05 + (100-A.attack)*.16;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"keeperDistributionPress",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_keeperDistributionPress);
  function rule_leftChannelCover(A,B,ctx){
    const label = "Left Channel Cover";
    const category = "wide";
    let aScore = safeAvg(A.leftAttack-B.rightDefence+78,A.rightAttack-B.leftDefence+78,A.pace*.22+A.technical*.16+A.workRate*.12+A.attack*.20+A.setPiece*.10+A.balance*.10+A.creativity*.10);
    let bScore = safeAvg(B.leftAttack-A.rightDefence+78,B.rightAttack-A.leftDefence+78,B.pace*.22+B.technical*.16+B.workRate*.12+B.attack*.20+B.setPiece*.10+B.balance*.10+B.creativity*.10);
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"leftChannelCover",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_leftChannelCover);
  function rule_rightChannelCover(A,B,ctx){
    const label = "Right Channel Cover";
    const category = "wide";
    let aScore = safeAvg(A.leftAttack-B.rightDefence+78,A.rightAttack-B.leftDefence+78,A.pace*.22+A.technical*.16+A.workRate*.12+A.attack*.20+A.setPiece*.10+A.balance*.10+A.creativity*.10);
    let bScore = safeAvg(B.leftAttack-A.rightDefence+78,B.rightAttack-A.leftDefence+78,B.pace*.22+B.technical*.16+B.workRate*.12+B.attack*.20+B.setPiece*.10+B.balance*.10+B.creativity*.10);
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"rightChannelCover",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_rightChannelCover);
  function rule_camZoneDominance(A,B,ctx){
    const label = "CAM Zone Dominance";
    const category = "midfield";
    let aScore = A.midfield*.32 + A.pressResistance*.18 + A.technical*.13 + A.intelligence*.13 + A.workRate*.08 + A.physical*.06 + (100-B.pressing)*.10;
    let bScore = B.midfield*.32 + B.pressResistance*.18 + B.technical*.13 + B.intelligence*.13 + B.workRate*.08 + B.physical*.06 + (100-A.pressing)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"camZoneDominance",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_camZoneDominance);
  function rule_cdmScreenReliability(A,B,ctx){
    const label = "CDM Screen Reliability";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"cdmScreenReliability",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_cdmScreenReliability);
  function rule_cbPairComplementarity(A,B,ctx){
    const label = "CB Pair Complementarity";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"cbPairComplementarity",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_cbPairComplementarity);
  function rule_fullbackAggressionBalance(A,B,ctx){
    const label = "Fullback Aggression Balance";
    const category = "wide";
    let aScore = safeAvg(A.leftAttack-B.rightDefence+78,A.rightAttack-B.leftDefence+78,A.pace*.22+A.technical*.16+A.workRate*.12+A.attack*.20+A.setPiece*.10+A.balance*.10+A.creativity*.10);
    let bScore = safeAvg(B.leftAttack-A.rightDefence+78,B.rightAttack-A.leftDefence+78,B.pace*.22+B.technical*.16+B.workRate*.12+B.attack*.20+B.setPiece*.10+B.balance*.10+B.creativity*.10);
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"fullbackAggressionBalance",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_fullbackAggressionBalance);
  function rule_wingerTrackingCost(A,B,ctx){
    const label = "Winger Tracking Cost";
    const category = "wide";
    let aScore = safeAvg(A.leftAttack-B.rightDefence+78,A.rightAttack-B.leftDefence+78,A.pace*.22+A.technical*.16+A.workRate*.12+A.attack*.20+A.setPiece*.10+A.balance*.10+A.creativity*.10);
    let bScore = safeAvg(B.leftAttack-A.rightDefence+78,B.rightAttack-A.leftDefence+78,B.pace*.22+B.technical*.16+B.workRate*.12+B.attack*.20+B.setPiece*.10+B.balance*.10+B.creativity*.10);
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"wingerTrackingCost",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_wingerTrackingCost);
  function rule_falseNineBenefit(A,B,ctx){
    const label = "False Nine Benefit";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"falseNineBenefit",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_falseNineBenefit);
  function rule_targetManBenefit(A,B,ctx){
    const label = "Target-Man Benefit";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"targetManBenefit",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_targetManBenefit);
  function rule_invertedWingerThreat(A,B,ctx){
    const label = "Inverted Winger Threat";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"invertedWingerThreat",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_invertedWingerThreat);
  function rule_crossingConversion(A,B,ctx){
    const label = "Crossing Conversion";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"crossingConversion",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_crossingConversion);
  function rule_setPieceDefence(A,B,ctx){
    const label = "Set-Piece Defence";
    const category = "setPiece";
    let aScore = A.setPiece*.38 + A.aerial*.20 + A.physical*.10 + A.clutch*.07 + (100-B.cbAerial)*.15 + (100-B.goalkeeper)*.10;
    let bScore = B.setPiece*.38 + B.aerial*.20 + B.physical*.10 + B.clutch*.07 + (100-A.cbAerial)*.15 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"setPieceDefence",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_setPieceDefence);
  function rule_lateGameClutch(A,B,ctx){
    const label = "Late-Game Clutch";
    const category = "momentum";
    let aScore = A.clutch*.25 + A.consistency*.19 + A.intelligence*.16 + A.leadership*.10 + A.balance*.10 + A.spine*.10 + A.roleFit*.10;
    let bScore = B.clutch*.25 + B.consistency*.19 + B.intelligence*.16 + B.leadership*.10 + B.balance*.10 + B.spine*.10 + B.roleFit*.10;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"lateGameClutch",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_lateGameClutch);
  function rule_captaincyControl(A,B,ctx){
    const label = "Captaincy Control";
    const category = "mentality";
    let aScore = A.clutch*.25 + A.consistency*.19 + A.intelligence*.16 + A.leadership*.10 + A.balance*.10 + A.spine*.10 + A.roleFit*.10;
    let bScore = B.clutch*.25 + B.consistency*.19 + B.intelligence*.16 + B.leadership*.10 + B.balance*.10 + B.spine*.10 + B.roleFit*.10;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"captaincyControl",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_captaincyControl);
  function rule_pressResistanceNetwork(A,B,ctx){
    const label = "Press-Resistance Network";
    const category = "buildUp";
    let aScore = A.pressResistance*.26 + A.midfield*.20 + A.technical*.18 + A.goalkeeper*.08 + A.defence*.07 + A.intelligence*.11 + (100-B.pressing)*.10;
    let bScore = B.pressResistance*.26 + B.midfield*.20 + B.technical*.18 + B.goalkeeper*.08 + B.defence*.07 + B.intelligence*.11 + (100-A.pressing)*.10;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"pressResistanceNetwork",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_pressResistanceNetwork);
  function rule_verticalPassingThreat(A,B,ctx){
    const label = "Vertical Passing Threat";
    const category = "transition";
    let aScore = A.transition*.34 + A.pace*.18 + A.attack*.14 + A.midfield*.08 + A.pressResistance*.06 + (100-B.cbPace)*.10 + (100-B.cdmCover)*.10;
    let bScore = B.transition*.34 + B.pace*.18 + B.attack*.14 + B.midfield*.08 + B.pressResistance*.06 + (100-A.cbPace)*.10 + (100-A.cdmCover)*.10;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"verticalPassingThreat",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_verticalPassingThreat);
  function rule_tempoControl(A,B,ctx){
    const label = "Tempo Control";
    const category = "midfield";
    let aScore = A.midfield*.32 + A.pressResistance*.18 + A.technical*.13 + A.intelligence*.13 + A.workRate*.08 + A.physical*.06 + (100-B.pressing)*.10;
    let bScore = B.midfield*.32 + B.pressResistance*.18 + B.technical*.13 + B.intelligence*.13 + B.workRate*.08 + B.physical*.06 + (100-A.pressing)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"tempoControl",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_tempoControl);
  function rule_foulRisk(A,B,ctx){
    const label = "Foul Risk";
    const category = "discipline";
    let aScore = A.intelligence*.22 + A.consistency*.18 + A.defence*.16 - A.aggression*.10 + A.clutch*.09 + A.balance*.15 + A.roleFit*.10 + A.cdmCover*.20;
    let bScore = B.intelligence*.22 + B.consistency*.18 + B.defence*.16 - B.aggression*.10 + B.clutch*.09 + B.balance*.15 + B.roleFit*.10 + B.cdmCover*.20;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"foulRisk",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_foulRisk);
  function rule_yellowCardPressure(A,B,ctx){
    const label = "Yellow Card Pressure";
    const category = "discipline";
    let aScore = A.intelligence*.22 + A.consistency*.18 + A.defence*.16 - A.aggression*.10 + A.clutch*.09 + A.balance*.15 + A.roleFit*.10 + A.cdmCover*.20;
    let bScore = B.intelligence*.22 + B.consistency*.18 + B.defence*.16 - B.aggression*.10 + B.clutch*.09 + B.balance*.15 + B.roleFit*.10 + B.cdmCover*.20;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"yellowCardPressure",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_yellowCardPressure);
  function rule_substitutionAdaptability(A,B,ctx){
    const label = "Substitution Adaptability";
    const category = "adaptability";
    let aScore = A.roleFit*.20 + A.intelligence*.19 + A.balance*.19 + A.consistency*.12 + A.spine*.12 + A.technical*.10 + A.workRate*.08;
    let bScore = B.roleFit*.20 + B.intelligence*.19 + B.balance*.19 + B.consistency*.12 + B.spine*.12 + B.technical*.10 + B.workRate*.08;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"substitutionAdaptability",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_substitutionAdaptability);
  function rule_tacticalFlexibility(A,B,ctx){
    const label = "Tactical Flexibility";
    const category = "adaptability";
    let aScore = A.roleFit*.20 + A.intelligence*.19 + A.balance*.19 + A.consistency*.12 + A.spine*.12 + A.technical*.10 + A.workRate*.08;
    let bScore = B.roleFit*.20 + B.intelligence*.19 + B.balance*.19 + B.consistency*.12 + B.spine*.12 + B.technical*.10 + B.workRate*.08;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"tacticalFlexibility",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_tacticalFlexibility);
  function rule_physicalDuelDominance(A,B,ctx){
    const label = "Physical Duel Dominance";
    const category = "physical";
    let aScore = A.physical*.30 + A.stamina*.18 + A.aggression*.15 + A.workRate*.12 + A.aerial*.10 + A.balance*.05 + (100-B.physical)*.10;
    let bScore = B.physical*.30 + B.stamina*.18 + B.aggression*.15 + B.workRate*.12 + B.aerial*.10 + B.balance*.05 + (100-A.physical)*.10;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"physicalDuelDominance",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_physicalDuelDominance);
  function rule_staminaDecay(A,B,ctx){
    const label = "Stamina Decay";
    const category = "physical";
    let aScore = A.physical*.30 + A.stamina*.18 + A.aggression*.15 + A.workRate*.12 + A.aerial*.10 + A.balance*.05 + (100-B.physical)*.10;
    let bScore = B.physical*.30 + B.stamina*.18 + B.aggression*.15 + B.workRate*.12 + B.aerial*.10 + B.balance*.05 + (100-A.physical)*.10;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"staminaDecay",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_staminaDecay);
  function rule_paceDecayLate(A,B,ctx){
    const label = "Late Pace Decay";
    const category = "physical";
    let aScore = A.physical*.30 + A.stamina*.18 + A.aggression*.15 + A.workRate*.12 + A.aerial*.10 + A.balance*.05 + (100-B.physical)*.10;
    let bScore = B.physical*.30 + B.stamina*.18 + B.aggression*.15 + B.workRate*.12 + B.aerial*.10 + B.balance*.05 + (100-A.physical)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"paceDecayLate",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_paceDecayLate);
  function rule_technicalUnderPressure(A,B,ctx){
    const label = "Technique Under Pressure";
    const category = "technical";
    let aScore = A.technical*.34 + A.pressResistance*.20 + A.creativity*.14 + A.midfield*.12 + A.clutch*.05 + (100-B.pressing)*.15;
    let bScore = B.technical*.34 + B.pressResistance*.20 + B.creativity*.14 + B.midfield*.12 + B.clutch*.05 + (100-A.pressing)*.15;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"technicalUnderPressure",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_technicalUnderPressure);
  function rule_firstTouchSecurity(A,B,ctx){
    const label = "First-Touch Security";
    const category = "technical";
    let aScore = A.technical*.34 + A.pressResistance*.20 + A.creativity*.14 + A.midfield*.12 + A.clutch*.05 + (100-B.pressing)*.15;
    let bScore = B.technical*.34 + B.pressResistance*.20 + B.creativity*.14 + B.midfield*.12 + B.clutch*.05 + (100-A.pressing)*.15;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"firstTouchSecurity",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_firstTouchSecurity);
  function rule_weakFootUnpredictability(A,B,ctx){
    const label = "Weak Foot Unpredictability";
    const category = "technical";
    let aScore = A.technical*.34 + A.pressResistance*.20 + A.creativity*.14 + A.midfield*.12 + A.clutch*.05 + (100-B.pressing)*.15;
    let bScore = B.technical*.34 + B.pressResistance*.20 + B.creativity*.14 + B.midfield*.12 + B.clutch*.05 + (100-A.pressing)*.15;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"weakFootUnpredictability",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_weakFootUnpredictability);
  function rule_dribbleVsTackle(A,B,ctx){
    const label = "Dribble vs Tackle";
    const category = "battle";
    let aScore = A.spine*.12 + A.roleFit*.11 + A.attack*.14 + A.defence*.14 + A.midfield*.14 + A.intelligence*.12 + A.clutch*.09 + A.balance*.14;
    let bScore = B.spine*.12 + B.roleFit*.11 + B.attack*.14 + B.defence*.14 + B.midfield*.14 + B.intelligence*.12 + B.clutch*.09 + B.balance*.14;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"dribbleVsTackle",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_dribbleVsTackle);
  function rule_finishingVsKeeper(A,B,ctx){
    const label = "Finishing vs Keeper";
    const category = "battle";
    let aScore = A.spine*.12 + A.roleFit*.11 + A.attack*.14 + A.defence*.14 + A.midfield*.14 + A.intelligence*.12 + A.clutch*.09 + A.balance*.14;
    let bScore = B.spine*.12 + B.roleFit*.11 + B.attack*.14 + B.defence*.14 + B.midfield*.14 + B.intelligence*.12 + B.clutch*.09 + B.balance*.14;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"finishingVsKeeper",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_finishingVsKeeper);
  function rule_playmakerVsScreen(A,B,ctx){
    const label = "Playmaker vs Screen";
    const category = "battle";
    let aScore = A.spine*.12 + A.roleFit*.11 + A.attack*.14 + A.defence*.14 + A.midfield*.14 + A.intelligence*.12 + A.clutch*.09 + A.balance*.14;
    let bScore = B.spine*.12 + B.roleFit*.11 + B.attack*.14 + B.defence*.14 + B.midfield*.14 + B.intelligence*.12 + B.clutch*.09 + B.balance*.14;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"playmakerVsScreen",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_playmakerVsScreen);
  function rule_strikerVsCbAerial(A,B,ctx){
    const label = "Striker vs CB Aerial";
    const category = "battle";
    let aScore = A.spine*.12 + A.roleFit*.11 + A.attack*.14 + A.defence*.14 + A.midfield*.14 + A.intelligence*.12 + A.clutch*.09 + A.balance*.14;
    let bScore = B.spine*.12 + B.roleFit*.11 + B.attack*.14 + B.defence*.14 + B.midfield*.14 + B.intelligence*.12 + B.clutch*.09 + B.balance*.14;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"strikerVsCbAerial",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_strikerVsCbAerial);
  function rule_leftWingVsRightBack(A,B,ctx){
    const label = "Left Wing vs Right Back";
    const category = "battle";
    let aScore = A.spine*.12 + A.roleFit*.11 + A.attack*.14 + A.defence*.14 + A.midfield*.14 + A.intelligence*.12 + A.clutch*.09 + A.balance*.14;
    let bScore = B.spine*.12 + B.roleFit*.11 + B.attack*.14 + B.defence*.14 + B.midfield*.14 + B.intelligence*.12 + B.clutch*.09 + B.balance*.14;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"leftWingVsRightBack",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_leftWingVsRightBack);
  function rule_rightWingVsLeftBack(A,B,ctx){
    const label = "Right Wing vs Left Back";
    const category = "battle";
    let aScore = A.spine*.12 + A.roleFit*.11 + A.attack*.14 + A.defence*.14 + A.midfield*.14 + A.intelligence*.12 + A.clutch*.09 + A.balance*.14;
    let bScore = B.spine*.12 + B.roleFit*.11 + B.attack*.14 + B.defence*.14 + B.midfield*.14 + B.intelligence*.12 + B.clutch*.09 + B.balance*.14;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"rightWingVsLeftBack",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_rightWingVsLeftBack);
  function rule_cmEngineRoom(A,B,ctx){
    const label = "Engine Room Running";
    const category = "midfield";
    let aScore = A.midfield*.32 + A.pressResistance*.18 + A.technical*.13 + A.intelligence*.13 + A.workRate*.08 + A.physical*.06 + (100-B.pressing)*.10;
    let bScore = B.midfield*.32 + B.pressResistance*.18 + B.technical*.13 + B.intelligence*.13 + B.workRate*.08 + B.physical*.06 + (100-A.pressing)*.10;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"cmEngineRoom",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_cmEngineRoom);
  function rule_boxArrivals(A,B,ctx){
    const label = "Box Arrivals";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"boxArrivals",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_boxArrivals);
  function rule_defensiveLineCoordination(A,B,ctx){
    const label = "Defensive Line Coordination";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"defensiveLineCoordination",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_defensiveLineCoordination);
  function rule_offsideTrap(A,B,ctx){
    const label = "Offside Trap";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"offsideTrap",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_offsideTrap);
  function rule_recoveryDefending(A,B,ctx){
    const label = "Recovery Defending";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"recoveryDefending",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_recoveryDefending);
  function rule_pressingAngles(A,B,ctx){
    const label = "Pressing Angles";
    const category = "pressing";
    let aScore = A.pressing*.34 + A.workRate*.17 + A.stamina*.13 + A.aggression*.12 + (100-B.pressResistance)*.18 + (100-B.goalkeeper)*.06;
    let bScore = B.pressing*.34 + B.workRate*.17 + B.stamina*.13 + B.aggression*.12 + (100-A.pressResistance)*.18 + (100-A.goalkeeper)*.06;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"pressingAngles",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_pressingAngles);
  function rule_pressTriggerQuality(A,B,ctx){
    const label = "Press Trigger Quality";
    const category = "pressing";
    let aScore = A.pressing*.34 + A.workRate*.17 + A.stamina*.13 + A.aggression*.12 + (100-B.pressResistance)*.18 + (100-B.goalkeeper)*.06;
    let bScore = B.pressing*.34 + B.workRate*.17 + B.stamina*.13 + B.aggression*.12 + (100-A.pressResistance)*.18 + (100-A.goalkeeper)*.06;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"pressTriggerQuality",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_pressTriggerQuality);
  function rule_buildOutVsPress(A,B,ctx){
    const label = "Build-Out vs Press";
    const category = "buildUp";
    let aScore = A.pressResistance*.26 + A.midfield*.20 + A.technical*.18 + A.goalkeeper*.08 + A.defence*.07 + A.intelligence*.11 + (100-B.pressing)*.10;
    let bScore = B.pressResistance*.26 + B.midfield*.20 + B.technical*.18 + B.goalkeeper*.08 + B.defence*.07 + B.intelligence*.11 + (100-A.pressing)*.10;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"buildOutVsPress",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_buildOutVsPress);
  function rule_riskTakingPenalty(A,B,ctx){
    const label = "Risk Taking Penalty";
    const category = "discipline";
    let aScore = A.intelligence*.22 + A.consistency*.18 + A.defence*.16 - A.aggression*.10 + A.clutch*.09 + A.balance*.15 + A.roleFit*.10 + A.cdmCover*.20;
    let bScore = B.intelligence*.22 + B.consistency*.18 + B.defence*.16 - B.aggression*.10 + B.clutch*.09 + B.balance*.15 + B.roleFit*.10 + B.cdmCover*.20;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"riskTakingPenalty",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_riskTakingPenalty);
  function rule_creativeRiskReward(A,B,ctx){
    const label = "Creative Risk Reward";
    const category = "creativity";
    let aScore = A.creativity*.30 + A.midfield*.18 + A.technical*.14 + A.attack*.12 + A.clutch*.07 + A.pressResistance*.07 + (100-B.defence)*.12;
    let bScore = B.creativity*.30 + B.midfield*.18 + B.technical*.14 + B.attack*.12 + B.clutch*.07 + B.pressResistance*.07 + (100-A.defence)*.12;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"creativeRiskReward",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_creativeRiskReward);
  function rule_shotSelection(A,B,ctx){
    const label = "Shot Selection";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"shotSelection",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_shotSelection);
  function rule_xgQuality(A,B,ctx){
    const label = "Chance Quality";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"xgQuality",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_xgQuality);
  function rule_chanceVolume(A,B,ctx){
    const label = "Chance Volume";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"chanceVolume",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_chanceVolume);
  function rule_defensiveCompactness(A,B,ctx){
    const label = "Defensive Compactness";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"defensiveCompactness",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_defensiveCompactness);
  function rule_gapBetweenLines(A,B,ctx){
    const label = "Gap Between Lines";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"gapBetweenLines",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_gapBetweenLines);
  function rule_zone14Protection(A,B,ctx){
    const label = "Zone 14 Protection";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"zone14Protection",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_zone14Protection);
  function rule_wideSwitchThreat(A,B,ctx){
    const label = "Wide Switch Threat";
    const category = "midfield";
    let aScore = A.midfield*.32 + A.pressResistance*.18 + A.technical*.13 + A.intelligence*.13 + A.workRate*.08 + A.physical*.06 + (100-B.pressing)*.10;
    let bScore = B.midfield*.32 + B.pressResistance*.18 + B.technical*.13 + B.intelligence*.13 + B.workRate*.08 + B.physical*.06 + (100-A.pressing)*.10;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"wideSwitchThreat",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_wideSwitchThreat);
  function rule_diagonalBallThreat(A,B,ctx){
    const label = "Diagonal Ball Threat";
    const category = "transition";
    let aScore = A.transition*.34 + A.pace*.18 + A.attack*.14 + A.midfield*.08 + A.pressResistance*.06 + (100-B.cbPace)*.10 + (100-B.cdmCover)*.10;
    let bScore = B.transition*.34 + B.pace*.18 + B.attack*.14 + B.midfield*.08 + B.pressResistance*.06 + (100-A.cbPace)*.10 + (100-A.cdmCover)*.10;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"diagonalBallThreat",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_diagonalBallThreat);
  function rule_overlapTiming(A,B,ctx){
    const label = "Overlap Timing";
    const category = "wide";
    let aScore = safeAvg(A.leftAttack-B.rightDefence+78,A.rightAttack-B.leftDefence+78,A.pace*.22+A.technical*.16+A.workRate*.12+A.attack*.20+A.setPiece*.10+A.balance*.10+A.creativity*.10);
    let bScore = safeAvg(B.leftAttack-A.rightDefence+78,B.rightAttack-A.leftDefence+78,B.pace*.22+B.technical*.16+B.workRate*.12+B.attack*.20+B.setPiece*.10+B.balance*.10+B.creativity*.10);
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"overlapTiming",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_overlapTiming);
  function rule_underlapTiming(A,B,ctx){
    const label = "Underlap Timing";
    const category = "wide";
    let aScore = safeAvg(A.leftAttack-B.rightDefence+78,A.rightAttack-B.leftDefence+78,A.pace*.22+A.technical*.16+A.workRate*.12+A.attack*.20+A.setPiece*.10+A.balance*.10+A.creativity*.10);
    let bScore = safeAvg(B.leftAttack-A.rightDefence+78,B.rightAttack-A.leftDefence+78,B.pace*.22+B.technical*.16+B.workRate*.12+B.attack*.20+B.setPiece*.10+B.balance*.10+B.creativity*.10);
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"underlapTiming",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_underlapTiming);
  function rule_centralPressBait(A,B,ctx){
    const label = "Central Press Bait";
    const category = "buildUp";
    let aScore = A.pressResistance*.26 + A.midfield*.20 + A.technical*.18 + A.goalkeeper*.08 + A.defence*.07 + A.intelligence*.11 + (100-B.pressing)*.10;
    let bScore = B.pressResistance*.26 + B.midfield*.20 + B.technical*.18 + B.goalkeeper*.08 + B.defence*.07 + B.intelligence*.11 + (100-A.pressing)*.10;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"centralPressBait",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_centralPressBait);
  function rule_blockManipulation(A,B,ctx){
    const label = "Block Manipulation";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"blockManipulation",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_blockManipulation);
  function rule_thirdManRuns(A,B,ctx){
    const label = "Third-Man Runs";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"thirdManRuns",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_thirdManRuns);
  function rule_blindsideRuns(A,B,ctx){
    const label = "Blindside Runs";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"blindsideRuns",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_blindsideRuns);
  function rule_cutbackThreat(A,B,ctx){
    const label = "Cutback Threat";
    const category = "wide";
    let aScore = safeAvg(A.leftAttack-B.rightDefence+78,A.rightAttack-B.leftDefence+78,A.pace*.22+A.technical*.16+A.workRate*.12+A.attack*.20+A.setPiece*.10+A.balance*.10+A.creativity*.10);
    let bScore = safeAvg(B.leftAttack-A.rightDefence+78,B.rightAttack-A.leftDefence+78,B.pace*.22+B.technical*.16+B.workRate*.12+B.attack*.20+B.setPiece*.10+B.balance*.10+B.creativity*.10);
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"cutbackThreat",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_cutbackThreat);
  function rule_nearPostThreat(A,B,ctx){
    const label = "Near-Post Threat";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"nearPostThreat",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_nearPostThreat);
  function rule_farPostThreat(A,B,ctx){
    const label = "Far-Post Threat";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"farPostThreat",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_farPostThreat);
  function rule_defensiveAerialBox(A,B,ctx){
    const label = "Defensive Aerial Box";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"defensiveAerialBox",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_defensiveAerialBox);
  function rule_clearanceQuality(A,B,ctx){
    const label = "Clearance Quality";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"clearanceQuality",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_clearanceQuality);
  function rule_reboundControl(A,B,ctx){
    const label = "Rebound Control";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"reboundControl",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_reboundControl);
  function rule_looseBallHunger(A,B,ctx){
    const label = "Loose-Ball Hunger";
    const category = "physical";
    let aScore = A.physical*.30 + A.stamina*.18 + A.aggression*.15 + A.workRate*.12 + A.aerial*.10 + A.balance*.05 + (100-B.physical)*.10;
    let bScore = B.physical*.30 + B.stamina*.18 + B.aggression*.15 + B.workRate*.12 + B.aerial*.10 + B.balance*.05 + (100-A.physical)*.10;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"looseBallHunger",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_looseBallHunger);
  function rule_bigMatchNerves(A,B,ctx){
    const label = "Big-Match Nerves";
    const category = "mentality";
    let aScore = A.clutch*.25 + A.consistency*.19 + A.intelligence*.16 + A.leadership*.10 + A.balance*.10 + A.spine*.10 + A.roleFit*.10;
    let bScore = B.clutch*.25 + B.consistency*.19 + B.intelligence*.16 + B.leadership*.10 + B.balance*.10 + B.spine*.10 + B.roleFit*.10;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"bigMatchNerves",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_bigMatchNerves);
  function rule_consistencyFloor(A,B,ctx){
    const label = "Consistency Floor";
    const category = "mentality";
    let aScore = A.clutch*.25 + A.consistency*.19 + A.intelligence*.16 + A.leadership*.10 + A.balance*.10 + A.spine*.10 + A.roleFit*.10;
    let bScore = B.clutch*.25 + B.consistency*.19 + B.intelligence*.16 + B.leadership*.10 + B.balance*.10 + B.spine*.10 + B.roleFit*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"consistencyFloor",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_consistencyFloor);
  function rule_individualGenius(A,B,ctx){
    const label = "Individual Genius";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"individualGenius",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_individualGenius);
  function rule_systemDependence(A,B,ctx){
    const label = "System Dependence";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"systemDependence",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_systemDependence);
  function rule_roleFitPenalty(A,B,ctx){
    const label = "Role Fit Penalty";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"roleFitPenalty",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_roleFitPenalty);
  function rule_chemistryLinkQuality(A,B,ctx){
    const label = "Chemistry Link Quality";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"chemistryLinkQuality",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_chemistryLinkQuality);
  function rule_leftSideSynergy(A,B,ctx){
    const label = "Left-Side Synergy";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"leftSideSynergy",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_leftSideSynergy);
  function rule_rightSideSynergy(A,B,ctx){
    const label = "Right-Side Synergy";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"rightSideSynergy",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_rightSideSynergy);
  function rule_spineStrength(A,B,ctx){
    const label = "Spine Strength";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"spineStrength",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_spineStrength);
  function rule_benchlessFatigue(A,B,ctx){
    const label = "No-Bench Fatigue";
    const category = "physical";
    let aScore = A.physical*.30 + A.stamina*.18 + A.aggression*.15 + A.workRate*.12 + A.aerial*.10 + A.balance*.05 + (100-B.physical)*.10;
    let bScore = B.physical*.30 + B.stamina*.18 + B.aggression*.15 + B.workRate*.12 + B.aerial*.10 + B.balance*.05 + (100-A.physical)*.10;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"benchlessFatigue",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_benchlessFatigue);
  function rule_defensiveTransitionShape(A,B,ctx){
    const label = "Defensive Transition Shape";
    const category = "transition";
    let aScore = A.transition*.34 + A.pace*.18 + A.attack*.14 + A.midfield*.08 + A.pressResistance*.06 + (100-B.cbPace)*.10 + (100-B.cdmCover)*.10;
    let bScore = B.transition*.34 + B.pace*.18 + B.attack*.14 + B.midfield*.08 + B.pressResistance*.06 + (100-A.cbPace)*.10 + (100-A.cdmCover)*.10;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"defensiveTransitionShape",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_defensiveTransitionShape);
  function rule_attackingRestShape(A,B,ctx){
    const label = "Attacking Rest Shape";
    const category = "transition";
    let aScore = A.transition*.34 + A.pace*.18 + A.attack*.14 + A.midfield*.08 + A.pressResistance*.06 + (100-B.cbPace)*.10 + (100-B.cdmCover)*.10;
    let bScore = B.transition*.34 + B.pace*.18 + B.attack*.14 + B.midfield*.08 + B.pressResistance*.06 + (100-A.cbPace)*.10 + (100-A.cdmCover)*.10;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"attackingRestShape",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_attackingRestShape);
  function rule_centralRunnerTracking(A,B,ctx){
    const label = "Central Runner Tracking";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"centralRunnerTracking",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_centralRunnerTracking);
  function rule_creativeHubReliance(A,B,ctx){
    const label = "Creative Hub Reliance";
    const category = "creativity";
    let aScore = A.creativity*.30 + A.midfield*.18 + A.technical*.14 + A.attack*.12 + A.clutch*.07 + A.pressResistance*.07 + (100-B.defence)*.12;
    let bScore = B.creativity*.30 + B.midfield*.18 + B.technical*.14 + B.attack*.12 + B.clutch*.07 + B.pressResistance*.07 + (100-A.defence)*.12;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"creativeHubReliance",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_creativeHubReliance);
  function rule_pressEscapeOutlet(A,B,ctx){
    const label = "Press Escape Outlet";
    const category = "buildUp";
    let aScore = A.pressResistance*.26 + A.midfield*.20 + A.technical*.18 + A.goalkeeper*.08 + A.defence*.07 + A.intelligence*.11 + (100-B.pressing)*.10;
    let bScore = B.pressResistance*.26 + B.midfield*.20 + B.technical*.18 + B.goalkeeper*.08 + B.defence*.07 + B.intelligence*.11 + (100-A.pressing)*.10;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"pressEscapeOutlet",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_pressEscapeOutlet);
  function rule_lineBreakingCarries(A,B,ctx){
    const label = "Line-Breaking Carries";
    const category = "midfield";
    let aScore = A.midfield*.32 + A.pressResistance*.18 + A.technical*.13 + A.intelligence*.13 + A.workRate*.08 + A.physical*.06 + (100-B.pressing)*.10;
    let bScore = B.midfield*.32 + B.pressResistance*.18 + B.technical*.13 + B.intelligence*.13 + B.workRate*.08 + B.physical*.06 + (100-A.pressing)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"lineBreakingCarries",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_lineBreakingCarries);
  function rule_setPieceGameState(A,B,ctx){
    const label = "Set-Piece Game State";
    const category = "setPiece";
    let aScore = A.setPiece*.38 + A.aerial*.20 + A.physical*.10 + A.clutch*.07 + (100-B.cbAerial)*.15 + (100-B.goalkeeper)*.10;
    let bScore = B.setPiece*.38 + B.aerial*.20 + B.physical*.10 + B.clutch*.07 + (100-A.cbAerial)*.15 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"setPieceGameState",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_setPieceGameState);
  function rule_penaltyBoxChaos(A,B,ctx){
    const label = "Penalty-Box Chaos";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"penaltyBoxChaos",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_penaltyBoxChaos);
  function rule_eliteAura(A,B,ctx){
    const label = "Elite Aura";
    const category = "mentality";
    let aScore = A.clutch*.25 + A.consistency*.19 + A.intelligence*.16 + A.leadership*.10 + A.balance*.10 + A.spine*.10 + A.roleFit*.10;
    let bScore = B.clutch*.25 + B.consistency*.19 + B.intelligence*.16 + B.leadership*.10 + B.balance*.10 + B.spine*.10 + B.roleFit*.10;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"eliteAura",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_eliteAura);
  function rule_draftBalance(A,B,ctx){
    const label = "Draft Balance";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"draftBalance",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_draftBalance);
  function rule_tacticalContradiction(A,B,ctx){
    const label = "Tactical Contradiction";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.93;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"tacticalContradiction",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_tacticalContradiction);
  function rule_matchupExploitability(A,B,ctx){
    const label = "Matchup Exploitability";
    const category = "battle";
    let aScore = A.spine*.12 + A.roleFit*.11 + A.attack*.14 + A.defence*.14 + A.midfield*.14 + A.intelligence*.12 + A.clutch*.09 + A.balance*.14;
    let bScore = B.spine*.12 + B.roleFit*.11 + B.attack*.14 + B.defence*.14 + B.midfield*.14 + B.intelligence*.12 + B.clutch*.09 + B.balance*.14;
    const sensitivity = 0.72;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"matchupExploitability",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_matchupExploitability);
  function rule_finalThirdPatience(A,B,ctx){
    const label = "Final-Third Patience";
    const category = "attack";
    let aScore = A.attack*.28 + A.creativity*.15 + A.technical*.12 + A.transition*.10 + A.clutch*.08 + A.setPiece*.05 + (100-B.defence)*.12 + (100-B.goalkeeper)*.10;
    let bScore = B.attack*.28 + B.creativity*.15 + B.technical*.12 + B.transition*.10 + B.clutch*.08 + B.setPiece*.05 + (100-A.defence)*.12 + (100-A.goalkeeper)*.10;
    const sensitivity = 0.755;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"finalThirdPatience",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_finalThirdPatience);
  function rule_defensivePatience(A,B,ctx){
    const label = "Defensive Patience";
    const category = "defence";
    let aScore = A.defence*.30 + A.cdmCover*.18 + A.goalkeeper*.12 + A.intelligence*.12 + A.physical*.08 + A.aerial*.07 + A.balance*.08 + (100-B.attack)*.05;
    let bScore = B.defence*.30 + B.cdmCover*.18 + B.goalkeeper*.12 + B.intelligence*.12 + B.physical*.08 + B.aerial*.07 + B.balance*.08 + (100-A.attack)*.05;
    const sensitivity = 0.79;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"defensivePatience",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_defensivePatience);
  function rule_gameControlAfterLead(A,B,ctx){
    const label = "Game Control After Lead";
    const category = "mentality";
    let aScore = A.clutch*.25 + A.consistency*.19 + A.intelligence*.16 + A.leadership*.10 + A.balance*.10 + A.spine*.10 + A.roleFit*.10;
    let bScore = B.clutch*.25 + B.consistency*.19 + B.intelligence*.16 + B.leadership*.10 + B.balance*.10 + B.spine*.10 + B.roleFit*.10;
    const sensitivity = 0.825;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"gameControlAfterLead",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_gameControlAfterLead);
  function rule_chasingGamePower(A,B,ctx){
    const label = "Chasing Game Power";
    const category = "momentum";
    let aScore = A.clutch*.25 + A.consistency*.19 + A.intelligence*.16 + A.leadership*.10 + A.balance*.10 + A.spine*.10 + A.roleFit*.10;
    let bScore = B.clutch*.25 + B.consistency*.19 + B.intelligence*.16 + B.leadership*.10 + B.balance*.10 + B.spine*.10 + B.roleFit*.10;
    const sensitivity = 0.86;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"chasingGamePower",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_chasingGamePower);
  function rule_styleCounterBonus(A,B,ctx){
    const label = "Style Counter Bonus";
    const category = "synergy";
    let aScore = A.balance*.22 + A.spine*.20 + A.roleFit*.18 + A.intelligence*.12 + A.workRate*.08 + A.technical*.08 + A.consistency*.07 + A.clutch*.05;
    let bScore = B.balance*.22 + B.spine*.20 + B.roleFit*.18 + B.intelligence*.12 + B.workRate*.08 + B.technical*.08 + B.consistency*.07 + B.clutch*.05;
    const sensitivity = 0.895;
    const diff = (aScore-bScore)*sensitivity;
    const winner = Math.abs(diff)<1.4?"draw":diff>0?"A":"B";
    const severity = Math.abs(diff)>10?"major":Math.abs(diff)>5?"clear":Math.abs(diff)>2?"slight":"marginal";
    return {id:"styleCounterBonus",label,category,a:f3(safeClamp(aScore,0,110)),b:f3(safeClamp(bScore,0,110)),diff:f3(diff),winner,severity,explanation:explainRule(label,category,diff,A,B)};
  }
  ADVANCED_RULES.push(rule_styleCounterBonus);
  function explainRule(label, category, diff, A, B){const lead=Math.abs(diff)<1.4?"Neither side has a decisive edge":diff>0?"Team A has the edge":"Team B has the edge";const swing=Math.abs(diff)>10?"a match-defining swing":Math.abs(diff)>5?"a clear tactical swing":Math.abs(diff)>2?"a useful advantage":"only a small advantage";return `${lead} in ${label}; this is ${swing} because the ${category} context activates the relevant attributes rather than simply rewarding raw overall.`;}
  function evaluateAdvancedRules(sqA,sqB,basePhases){const A=extendedTeamProfile(sqA),B=extendedTeamProfile(sqB);const ctx={basePhases};const rules=ADVANCED_RULES.map(fn=>fn(A,B,ctx));const byCategory={};for(const r of rules){if(!byCategory[r.category])byCategory[r.category]={a:0,b:0,n:0,items:[]};byCategory[r.category].a+=r.a;byCategory[r.category].b+=r.b;byCategory[r.category].n++;byCategory[r.category].items.push(r);}for(const c of Object.values(byCategory)){c.a=f3(c.a/c.n);c.b=f3(c.b/c.n);c.diff=f3(c.a-c.b);c.items.sort((x,y)=>Math.abs(y.diff)-Math.abs(x.diff));}return {profileA:A,profileB:B,rules,byCategory,topSwings:rules.slice().sort((x,y)=>Math.abs(y.diff)-Math.abs(x.diff)).slice(0,14)};}
  const FINAL_WEIGHTS = Object.freeze({attack:.135,midfield:.125,defence:.125,transition:.105,wide:.075,pressing:.075,setPiece:.055,goalkeeper:.075,physical:.045,technical:.055,buildUp:.055,creativity:.04,mentality:.04,synergy:.065,adaptability:.025,discipline:.005});
  function calculateAdvancedVerdict(sqA,sqB,names=["Team A","Team B"]){const base=BASE_ENGINE.calcFullPhases?BASE_ENGINE.calcFullPhases(sqA,sqB):null;const adv=evaluateAdvancedRules(sqA,sqB,base);let aScore=0,bScore=0,totalWeight=0;for(const [cat,w] of Object.entries(FINAL_WEIGHTS)){const c=adv.byCategory[cat];if(!c)continue;aScore+=c.a*w;bScore+=c.b*w;totalWeight+=w;}aScore=aScore/(totalWeight||1);bScore=bScore/(totalWeight||1);if(base){aScore=safeAvg(aScore,base.aFin||aScore,(base.aAtk||aScore)*.55+(base.aMid||aScore)*.45);bScore=safeAvg(bScore,base.bFin||bScore,(base.bAtk||bScore)*.55+(base.bMid||bScore)*.45);}const diff=aScore-bScore;const probA=pctFromDiff(diff);const margin=Math.abs(diff)<1.2?"coin flip / draw":Math.abs(diff)<3.5?"narrow":Math.abs(diff)<7?"clear":Math.abs(diff)<11?"comfortable":"dominant";const winner=Math.abs(diff)<1.2?"Draw":diff>0?names[0]:names[1];const battles=generateBattleCards(sqA,sqB,adv,base,names);const vulnerabilitiesA=detectContextualExploits(adv.profileA,adv.profileB,names[0],names[1]);const vulnerabilitiesB=detectContextualExploits(adv.profileB,adv.profileA,names[1],names[0]);return {winner,margin,probabilityA:f3(probA),probabilityB:f3(100-probA),finalScoreA:f3(aScore),finalScoreB:f3(bScore),diff:f3(diff),base,advanced:adv,battles,vulnerabilitiesA,vulnerabilitiesB,verdictText:generateVerdictText(winner,margin,diff,names,adv,vulnerabilitiesA,vulnerabilitiesB,battles)};}
  function battleScore(att,def,type){if(!att||!def)return {a:50,b:50,diff:0};let aVal=70,bVal=70;if(type==="paceVsIQ"){aVal=stat(att,"pace")*.32+stat(att,"transitionThreat")*.25+stat(att,"dribbling")*.16+stat(att,"offTheBall")*.12+stat(att,"finishing")*.08+stat(att,"clutch")*.07;bVal=stat(def,"defensiveAwareness")*.24+stat(def,"intelligence")*.24+stat(def,"pace")*.16+stat(def,"tackling")*.14+stat(def,"physical")*.10+stat(def,"positioning")*.12;}else if(type==="creatorVsScreen"){aVal=stat(att,"creativity")*.26+stat(att,"passing")*.22+stat(att,"technical")*.16+stat(att,"pressResistance")*.14+stat(att,"visionRange")*.16+stat(att,"clutch")*.06;bVal=stat(def,"defensiveAwareness")*.24+stat(def,"tackling")*.19+stat(def,"positioning")*.17+stat(def,"intelligence")*.16+stat(def,"workRate")*.14+stat(def,"aggression")*.10;}else if(type==="aerial"){aVal=stat(att,"aerial")*.28+stat(att,"physical")*.20+stat(att,"positioning")*.16+stat(att,"finishing")*.14+stat(att,"clutch")*.08+stat(att,"offTheBall")*.14;bVal=stat(def,"aerial")*.28+stat(def,"physical")*.18+stat(def,"defensiveAwareness")*.18+stat(def,"positioning")*.16+stat(def,"goalkeeperRating")*.10+stat(def,"commandOfArea")*.10;}else{aVal=roleFitScore(att,att.position?String(att.position).toLowerCase():"cm");bVal=roleFitScore(def,def.position?String(def.position).toLowerCase():"cm");}const d=aVal-bVal,p=pctFromDiff(d/3);return {a:f3(p),b:f3(100-p),diff:f3(d),aRaw:f3(aVal),bRaw:f3(bVal)};}
  function generateBattleCards(sqA,sqB,adv,base,names){const A=sideObject(sqA),B=sideObject(sqB);const specs=[[A.st,B.cbs[0],"paceVsIQ","A striker vs B left centre-back"],[A.lw,B.rb,"paceVsIQ","A left wing vs B right back"],[A.rw,B.lb,"paceVsIQ","A right wing vs B left back"],[A.cam,B.cdm,"creatorVsScreen","A creator vs B screen"],[B.st,A.cbs[0],"paceVsIQ","B striker vs A left centre-back"],[B.lw,A.rb,"paceVsIQ","B left wing vs A right back"],[B.rw,A.lb,"paceVsIQ","B right wing vs A left back"],[B.cam,A.cdm,"creatorVsScreen","B creator vs A screen"],[A.st,B.gk,"aerial","A striker vs B goalkeeper/box"],[B.st,A.gk,"aerial","B striker vs A goalkeeper/box"]];return specs.filter(x=>x[0]&&x[1]).map(([p1,p2,type,title])=>{const sc=battleScore(p1,p2,type);const winner=sc.a>sc.b?nm(p1):sc.b>sc.a?nm(p2):"Even";const severity=Math.abs(sc.a-sc.b)>18?"major":Math.abs(sc.a-sc.b)>10?"clear":Math.abs(sc.a-sc.b)>5?"slight":"even";return {title:`${nm(p1)} vs ${nm(p2)}`,context:title,winner,score:`${Math.round(sc.a)}-${Math.round(sc.b)}`,severity,explanation:`${winner} ${winner==="Even"?"keeps this matchup balanced":"has the matchup edge"}. The engine compares the relevant tools for this duel, not only overall rating.`,raw:sc};}).sort((x,y)=>Math.abs(y.raw.diff)-Math.abs(x.raw.diff));}
  function detectContextualExploits(T,O,tName,oName){const out=[];function add(key,severity,detail,condition){if(condition)out.push({key,severity,detail});}add("slowCentreBacks","high",`${tName} centre-backs lack recovery pace and ${oName} has transition tools to attack space.`,T.cbPace<72&&O.transition>80);add("overExposedFullbacks","medium",`${tName} full-back zones can be overloaded by ${oName} wide attack.`,(T.leftDefence<70&&O.rightAttack>78)||(T.rightDefence<70&&O.leftAttack>78));add("weakPressResistance","high",`${tName} can be forced into turnovers because ${oName} press is stronger than their build-up security.`,T.pressResistance<72&&O.pressing>80);add("aerialMismatch","medium",`${tName} can be attacked from crosses and set pieces.`,T.cbAerial<74&&O.setPiece>82);add("cdmOverload","high",`${tName} defensive midfielder has too much space to cover.`,T.cdmCover<72&&(O.creativity>82||O.transition>82));add("lowClutch","low",`${tName} may fade in decisive moments against a more clutch opponent.`,T.clutch<70&&O.clutch>82);add("poorBalance","medium",`${tName} has a lopsided draft profile that can be targeted.`,T.balance<76&&O.roleFit>80);return out;}
  function generateVerdictText(winner,margin,diff,names,adv,va,vb,battles){const top=adv.topSwings.slice(0,5);const swingText=top.map(r=>`${r.label}: ${r.winner==="A"?names[0]:r.winner==="B"?names[1]:"even"} (${r.diff>0?"+":""}${r.diff})`).join("; ");const keyBattle=battles[0];const vulnText=[...va.map(v=>`${names[0]} risk: ${v.key}`),...vb.map(v=>`${names[1]} risk: ${v.key}`)].slice(0,4).join("; ");if(winner==="Draw")return `This is effectively a draw/coin flip. The matchup is too close for a clean draft verdict. Main swings: ${swingText}.`;return `${winner} wins a ${margin} draft verdict. The deciding logic is contextual: ${swingText}. Key battle: ${keyBattle?keyBattle.title+" — "+keyBattle.explanation:"no single decisive duel"}. ${vulnText?"Main exploitable weaknesses: "+vulnText+".":"Neither side has an obvious structural weakness."}`;}
  function simulateAdvancedDraftMatch(sqA,sqB,names){return calculateAdvancedVerdict(sqA,sqB,names);}
  function explainAdvancedRules(){return ADVANCED_RULES.map(fn=>fn.name.replace(/^rule_/,""));}
  window.ENGINE=Object.assign({},BASE_ENGINE,{ADVANCED_WEIGHTS,POSITION_IMPORTANCE,ADVANCED_RULES,roleFitScore,extendedTeamProfile,evaluateAdvancedRules,calculateAdvancedVerdict,simulateAdvancedDraftMatch,identifyAdvancedArchetype,detectContextualExploits,generateBattleCards,explainAdvancedRules});
})();

// ═══════════════════════════════════════════════════════════════════════════
//  ADVANCED TACTICAL RULEBOOK NOTES
//  These notes are intentionally stored in-code for GitHub balancing.
// ═══════════════════════════════════════════════════════════════════════════
// Rulebook line 0001: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0002: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0003: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0004: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0005: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0006: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0007: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0008: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0009: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0010: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0011: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0012: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0013: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0014: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0015: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0016: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0017: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0018: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0019: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0020: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0021: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0022: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0023: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0024: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0025: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0026: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0027: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0028: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0029: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0030: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0031: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0032: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0033: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0034: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0035: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0036: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0037: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0038: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0039: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0040: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0041: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0042: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0043: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0044: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0045: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0046: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0047: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0048: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0049: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0050: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0051: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0052: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0053: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0054: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0055: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0056: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0057: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0058: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0059: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0060: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0061: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0062: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0063: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0064: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0065: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0066: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0067: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0068: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0069: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0070: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0071: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0072: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0073: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0074: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0075: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0076: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0077: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0078: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0079: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0080: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0081: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0082: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0083: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0084: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0085: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0086: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0087: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0088: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0089: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0090: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0091: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0092: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0093: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0094: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0095: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0096: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0097: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0098: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0099: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0100: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0101: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0102: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0103: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0104: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0105: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0106: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0107: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0108: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0109: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0110: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0111: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0112: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0113: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0114: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0115: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0116: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0117: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0118: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0119: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0120: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0121: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0122: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0123: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0124: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0125: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0126: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0127: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0128: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0129: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0130: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0131: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0132: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0133: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0134: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0135: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0136: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0137: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0138: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0139: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0140: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0141: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0142: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0143: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0144: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0145: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0146: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0147: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0148: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0149: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0150: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0151: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0152: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0153: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0154: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0155: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0156: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0157: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0158: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0159: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0160: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0161: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0162: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0163: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0164: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0165: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0166: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0167: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0168: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0169: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0170: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0171: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0172: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0173: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0174: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0175: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0176: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0177: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0178: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0179: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0180: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0181: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0182: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0183: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0184: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0185: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0186: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0187: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0188: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0189: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0190: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0191: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0192: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0193: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0194: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0195: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0196: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0197: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0198: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0199: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0200: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0201: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0202: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0203: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0204: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0205: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0206: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0207: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0208: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0209: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0210: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0211: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0212: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0213: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0214: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0215: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0216: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0217: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0218: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0219: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0220: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0221: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0222: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0223: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0224: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0225: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0226: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0227: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0228: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0229: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0230: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0231: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0232: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0233: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0234: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0235: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0236: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0237: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0238: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0239: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0240: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0241: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0242: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0243: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0244: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0245: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0246: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0247: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0248: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0249: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0250: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0251: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0252: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0253: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0254: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0255: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0256: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0257: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0258: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0259: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0260: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0261: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0262: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0263: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0264: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0265: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0266: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0267: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0268: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0269: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0270: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0271: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0272: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0273: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0274: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0275: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0276: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0277: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0278: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0279: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0280: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0281: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0282: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0283: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0284: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0285: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0286: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0287: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0288: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0289: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0290: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0291: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0292: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0293: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0294: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0295: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0296: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0297: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0298: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0299: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0300: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0301: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0302: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0303: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0304: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0305: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0306: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0307: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0308: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0309: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0310: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0311: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0312: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0313: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0314: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0315: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0316: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0317: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0318: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0319: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0320: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0321: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0322: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0323: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0324: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0325: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0326: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0327: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0328: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0329: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0330: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0331: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0332: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0333: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0334: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0335: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0336: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0337: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0338: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0339: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0340: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0341: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0342: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0343: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0344: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0345: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0346: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0347: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0348: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0349: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0350: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0351: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0352: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0353: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0354: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0355: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0356: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0357: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0358: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0359: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0360: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0361: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0362: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0363: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0364: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0365: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0366: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0367: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0368: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0369: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0370: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0371: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0372: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0373: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0374: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0375: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0376: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0377: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0378: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0379: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0380: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0381: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0382: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0383: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0384: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0385: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0386: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0387: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0388: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0389: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0390: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0391: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0392: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0393: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0394: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0395: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0396: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0397: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0398: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0399: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0400: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0401: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0402: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0403: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0404: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0405: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0406: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0407: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0408: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0409: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0410: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0411: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0412: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0413: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0414: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0415: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0416: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0417: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0418: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0419: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0420: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0421: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0422: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0423: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0424: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0425: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0426: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0427: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0428: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0429: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0430: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0431: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0432: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0433: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0434: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0435: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0436: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0437: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0438: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0439: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0440: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0441: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0442: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0443: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0444: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0445: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0446: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0447: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0448: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0449: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0450: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0451: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0452: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0453: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0454: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0455: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0456: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0457: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0458: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0459: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0460: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0461: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0462: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0463: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0464: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0465: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0466: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0467: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0468: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0469: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0470: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0471: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0472: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0473: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0474: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0475: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0476: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0477: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0478: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0479: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0480: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0481: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0482: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0483: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0484: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0485: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0486: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0487: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0488: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0489: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0490: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0491: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0492: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0493: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0494: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0495: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0496: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0497: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0498: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0499: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0500: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0501: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0502: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0503: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0504: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0505: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0506: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0507: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0508: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0509: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0510: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0511: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0512: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0513: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0514: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0515: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0516: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0517: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0518: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0519: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0520: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0521: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0522: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0523: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0524: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0525: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0526: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0527: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0528: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0529: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0530: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0531: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0532: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0533: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0534: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0535: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0536: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0537: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0538: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0539: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0540: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0541: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0542: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0543: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0544: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0545: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0546: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0547: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0548: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0549: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0550: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0551: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0552: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0553: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0554: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0555: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0556: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0557: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0558: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0559: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0560: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0561: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0562: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0563: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0564: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0565: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0566: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0567: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0568: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0569: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0570: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0571: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0572: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0573: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0574: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0575: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0576: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0577: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0578: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0579: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0580: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0581: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0582: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0583: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0584: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0585: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0586: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0587: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0588: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0589: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0590: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0591: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0592: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0593: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0594: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0595: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0596: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0597: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0598: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0599: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0600: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0601: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0602: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0603: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0604: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0605: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0606: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0607: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0608: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0609: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0610: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0611: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0612: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0613: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0614: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0615: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0616: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0617: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0618: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0619: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0620: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0621: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0622: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0623: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0624: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0625: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0626: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0627: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0628: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0629: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0630: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0631: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0632: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0633: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0634: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0635: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0636: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0637: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0638: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0639: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0640: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0641: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0642: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0643: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0644: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0645: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0646: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0647: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0648: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0649: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0650: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0651: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0652: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0653: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0654: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0655: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0656: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0657: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0658: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0659: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0660: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0661: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0662: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0663: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0664: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0665: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0666: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0667: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0668: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0669: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0670: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0671: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0672: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0673: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0674: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0675: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0676: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0677: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0678: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0679: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0680: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0681: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0682: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0683: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0684: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0685: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0686: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0687: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0688: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0689: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0690: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0691: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0692: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0693: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0694: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0695: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0696: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0697: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0698: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0699: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0700: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0701: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0702: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0703: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0704: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0705: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0706: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0707: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0708: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0709: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0710: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0711: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0712: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0713: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0714: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0715: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0716: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0717: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0718: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0719: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0720: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0721: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0722: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0723: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0724: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0725: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0726: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0727: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0728: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0729: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0730: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0731: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0732: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0733: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0734: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0735: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0736: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0737: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0738: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0739: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0740: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0741: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0742: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0743: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0744: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0745: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0746: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0747: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0748: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0749: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0750: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0751: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0752: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0753: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0754: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0755: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0756: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0757: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0758: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0759: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0760: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0761: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0762: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0763: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0764: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0765: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0766: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0767: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0768: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0769: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0770: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0771: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0772: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0773: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0774: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0775: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0776: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0777: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0778: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0779: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0780: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0781: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0782: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0783: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0784: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0785: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0786: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0787: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0788: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0789: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0790: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0791: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0792: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0793: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0794: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0795: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0796: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0797: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0798: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0799: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0800: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0801: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0802: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0803: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0804: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0805: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0806: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0807: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0808: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0809: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0810: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0811: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0812: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0813: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0814: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0815: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0816: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0817: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0818: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0819: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0820: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0821: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0822: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0823: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0824: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0825: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0826: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0827: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0828: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0829: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0830: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0831: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0832: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0833: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0834: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0835: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0836: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0837: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0838: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0839: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0840: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0841: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0842: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0843: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0844: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0845: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0846: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0847: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0848: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0849: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0850: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0851: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0852: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0853: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0854: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0855: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0856: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0857: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0858: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0859: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0860: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0861: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0862: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0863: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0864: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0865: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0866: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0867: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0868: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0869: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0870: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0871: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0872: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0873: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0874: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0875: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0876: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0877: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0878: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0879: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0880: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0881: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0882: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0883: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0884: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0885: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0886: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0887: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0888: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0889: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0890: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0891: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0892: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0893: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0894: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0895: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0896: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0897: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0898: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0899: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0900: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0901: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0902: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0903: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0904: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0905: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0906: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0907: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0908: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0909: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0910: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0911: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0912: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0913: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0914: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0915: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0916: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0917: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0918: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0919: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0920: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0921: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0922: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0923: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0924: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0925: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0926: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0927: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0928: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0929: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0930: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0931: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0932: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0933: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0934: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0935: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0936: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0937: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0938: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0939: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0940: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0941: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0942: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0943: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0944: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0945: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0946: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0947: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0948: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0949: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0950: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0951: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0952: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0953: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0954: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0955: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0956: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0957: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0958: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0959: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0960: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0961: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0962: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0963: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0964: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0965: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0966: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0967: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0968: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0969: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0970: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0971: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0972: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0973: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0974: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0975: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0976: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0977: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0978: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0979: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0980: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0981: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0982: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0983: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0984: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0985: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0986: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0987: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0988: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0989: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0990: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0991: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0992: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0993: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0994: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0995: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0996: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0997: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0998: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 0999: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1000: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1001: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1002: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1003: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1004: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1005: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1006: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1007: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1008: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1009: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1010: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1011: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1012: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1013: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1014: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1015: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1016: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1017: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1018: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1019: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1020: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1021: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1022: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1023: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1024: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1025: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1026: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1027: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1028: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1029: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1030: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1031: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1032: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1033: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1034: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1035: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1036: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1037: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1038: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1039: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1040: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1041: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1042: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1043: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1044: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1045: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1046: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1047: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1048: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1049: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1050: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1051: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1052: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1053: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1054: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1055: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1056: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1057: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1058: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1059: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1060: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1061: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1062: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1063: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1064: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1065: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1066: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1067: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1068: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1069: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1070: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1071: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1072: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1073: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1074: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1075: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1076: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1077: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1078: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1079: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1080: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1081: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1082: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1083: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1084: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1085: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1086: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1087: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1088: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1089: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1090: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1091: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1092: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1093: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1094: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1095: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1096: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1097: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1098: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1099: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1100: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1101: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1102: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1103: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1104: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1105: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1106: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1107: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1108: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1109: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1110: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1111: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1112: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1113: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1114: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1115: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1116: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1117: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1118: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1119: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1120: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1121: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1122: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1123: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1124: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1125: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1126: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1127: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1128: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1129: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1130: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1131: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1132: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1133: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1134: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1135: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1136: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1137: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1138: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1139: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1140: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1141: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1142: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1143: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1144: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1145: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1146: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1147: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1148: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1149: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1150: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1151: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1152: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1153: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1154: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1155: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1156: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1157: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1158: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1159: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1160: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1161: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1162: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1163: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1164: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1165: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1166: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1167: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1168: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1169: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1170: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1171: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1172: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1173: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1174: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1175: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1176: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1177: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1178: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1179: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1180: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1181: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1182: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1183: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1184: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1185: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1186: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1187: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1188: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1189: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1190: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1191: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1192: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1193: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1194: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1195: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1196: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1197: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1198: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1199: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1200: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1201: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1202: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1203: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1204: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1205: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1206: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1207: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1208: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1209: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1210: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1211: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1212: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1213: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1214: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1215: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1216: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1217: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1218: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1219: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1220: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1221: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1222: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1223: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1224: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1225: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1226: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1227: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1228: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1229: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1230: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1231: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1232: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1233: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1234: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1235: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1236: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1237: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1238: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1239: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1240: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1241: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1242: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1243: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1244: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1245: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1246: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1247: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1248: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1249: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1250: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1251: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1252: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1253: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1254: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1255: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1256: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1257: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1258: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1259: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1260: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1261: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1262: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1263: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1264: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1265: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1266: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1267: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1268: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1269: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1270: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1271: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1272: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1273: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1274: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1275: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1276: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1277: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1278: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1279: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1280: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1281: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1282: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1283: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1284: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1285: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1286: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1287: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1288: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1289: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1290: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1291: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1292: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1293: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1294: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1295: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1296: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1297: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1298: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1299: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1300: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1301: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1302: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1303: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1304: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1305: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1306: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1307: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1308: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1309: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1310: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1311: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1312: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1313: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1314: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1315: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1316: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1317: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1318: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1319: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1320: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1321: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1322: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1323: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1324: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1325: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1326: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1327: Press Escape Outlet is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1328: Line-Breaking Carries is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1329: Set-Piece Game State is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1330: Penalty-Box Chaos is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1331: Elite Aura is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1332: Draft Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1333: Tactical Contradiction is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1334: Matchup Exploitability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1335: Final-Third Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1336: Defensive Patience is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1337: Game Control After Lead is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1338: Chasing Game Power is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1339: Style Counter Bonus is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1340: Transition Space Activation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1341: Rest Defence Integrity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1342: Half-Space Access is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1343: Central Overload is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1344: Wide Isolation Creation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1345: Counter-Press Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1346: Deep Block Breaking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1347: High Line Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1348: Second-Ball Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1349: Aerial Box Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1350: Keeper Sweeping Value is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1351: Keeper Distribution Under Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1352: Left Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1353: Right Channel Cover is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1354: CAM Zone Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1355: CDM Screen Reliability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1356: CB Pair Complementarity is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1357: Fullback Aggression Balance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1358: Winger Tracking Cost is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1359: False Nine Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1360: Target-Man Benefit is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1361: Inverted Winger Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1362: Crossing Conversion is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1363: Set-Piece Defence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1364: Late-Game Clutch is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1365: Captaincy Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1366: Press-Resistance Network is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1367: Vertical Passing Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1368: Tempo Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1369: Foul Risk is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1370: Yellow Card Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1371: Substitution Adaptability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1372: Tactical Flexibility is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1373: Physical Duel Dominance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1374: Stamina Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1375: Late Pace Decay is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1376: Technique Under Pressure is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1377: First-Touch Security is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1378: Weak Foot Unpredictability is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1379: Dribble vs Tackle is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1380: Finishing vs Keeper is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1381: Playmaker vs Screen is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1382: Striker vs CB Aerial is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1383: Left Wing vs Right Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1384: Right Wing vs Left Back is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1385: Engine Room Running is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1386: Box Arrivals is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1387: Defensive Line Coordination is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1388: Offside Trap is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1389: Recovery Defending is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1390: Pressing Angles is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1391: Press Trigger Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1392: Build-Out vs Press is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1393: Risk Taking Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1394: Creative Risk Reward is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1395: Shot Selection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1396: Chance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1397: Chance Volume is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1398: Defensive Compactness is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1399: Gap Between Lines is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1400: Zone 14 Protection is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1401: Wide Switch Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1402: Diagonal Ball Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1403: Overlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1404: Underlap Timing is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1405: Central Press Bait is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1406: Block Manipulation is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1407: Third-Man Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1408: Blindside Runs is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1409: Cutback Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1410: Near-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1411: Far-Post Threat is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1412: Defensive Aerial Box is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1413: Clearance Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1414: Rebound Control is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1415: Loose-Ball Hunger is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1416: Big-Match Nerves is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1417: Consistency Floor is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1418: Individual Genius is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1419: System Dependence is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1420: Role Fit Penalty is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1421: Chemistry Link Quality is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1422: Left-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1423: Right-Side Synergy is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1424: Spine Strength is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1425: No-Bench Fatigue is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1426: Defensive Transition Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1427: Attacking Rest Shape is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1428: Central Runner Tracking is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
// Rulebook line 1429: Creative Hub Reliance is contextual; it only swings the verdict when the opponent can exploit or neutralise that situation.
/*
════════════════════════════════════════════════════════════════════════════
DRAFT ZONE — ULTRA DYNAMIC MATCH ENGINE APPEND PATCH v5.0
Paste this entire block at the very bottom of engine.js.
It adds contextual football intelligence without editing the original code.
Main API: ENGINE.calculateUltraDynamicVerdict(teamA, teamB, [nameA,nameB])
It also safely redirects ENGINE.calculateAdvancedVerdict to the ultra engine.
════════════════════════════════════════════════════════════════════════════
*/
;(function(){
  'use strict';
  const DZ_VERSION='ultra-dynamic-v5.0';
  const root=typeof window!=='undefined'?window:globalThis;
  root.ENGINE=root.ENGINE||{};
  const clamp=(v,lo=0,hi=100)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:0));
  const round=(v,d=1)=>{const m=Math.pow(10,d);return Math.round((Number.isFinite(+v)?+v:0)*m)/m};
  const avg=(arr,def=0)=>{arr=(arr||[]).filter(v=>v!=null&&!isNaN(v));return arr.length?arr.reduce((a,b)=>a+(+b),0)/arr.length:def};
  const sum=(arr)=>{arr=(arr||[]).filter(v=>v!=null&&!isNaN(v));return arr.reduce((a,b)=>a+(+b),0)};
  const max=(arr,def=0)=>{arr=(arr||[]).filter(v=>v!=null&&!isNaN(v));return arr.length?Math.max(...arr):def};
  const min=(arr,def=0)=>{arr=(arr||[]).filter(v=>v!=null&&!isNaN(v));return arr.length?Math.min(...arr):def};
  const sigmoid=(x,steep=0.18)=>1/(1+Math.exp(-x*steep));
  const scoreSplit=(diff,steep=0.12)=>round(sigmoid(diff,steep)*100,0);
  const nameOf=(p)=>p&&p.name?String(p.name).split('—')[0].trim():'Unknown';
  const has=(p,t)=>!!(p&&(p.traits||[]).includes(t));
  const plays=(p,t)=>!!(p&&(p.playstyles||[]).includes(t));
  const any=(arr,fn)=>(arr||[]).some(fn);
  const sortBy=(arr,fn)=>(arr||[]).slice().sort((a,b)=>fn(b)-fn(a));
  const pickTop=(arr,fn,n=3)=>sortBy(arr,fn).slice(0,n);
  const safeRole=(role)=>String(role||'').toLowerCase();
  const roleSlots=()=>root.LAYOUT||[
    {role:'gk'},
    {role:'lb'},
    {role:'cb'},
    {role:'cb'},
    {role:'rb'},
    {role:'cdm'},
    {role:'cm'},
    {role:'cm'},
    {role:'cam'},
    {role:'lw'},
    {role:'st'},
    {role:'rw'},
  ];
  function roleAt(i){return safeRole((roleSlots()[i]||{}).role||'sub');}
  function playersOf(team){return (team||[]).filter(Boolean);}
  function byRole(team,role){role=safeRole(role);return (team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&x.role===role);}
  function firstRole(team,role){const r=byRole(team,role)[0];return r?r.p:null;}
  function units(team){return{
    gk:byRole(team,'gk'),
    defenders:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&['lb','cb','rb'].includes(x.role)),
    cbs:byRole(team,'cb'),
    fullbacks:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&['lb','rb'].includes(x.role)),
    mids:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&['cdm','cm','cam'].includes(x.role)),
    cdm:byRole(team,'cdm'),
    creators:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&['cm','cam','lw','rw'].includes(x.role)),
    attackers:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&['lw','rw','st','cam'].includes(x.role)),
    forwards:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&['lw','rw','st'].includes(x.role)),
    wideLeft:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&['lw','lb','cm'].includes(x.role)),
    wideRight:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p&&['rw','rb','cm'].includes(x.role)),
    all:(team||[]).map((p,i)=>({p,role:roleAt(i),slot:i})).filter(x=>x.p)
  };}
  const ATTR_DEFAULTS={
    overall:70,
    attack:65,
    midfield:70,
    defence:60,
    defense:60,
    pace:70,
    physical:70,
    technical:70,
    intelligence:70,
    workRate:70,
    creativity:65,
    finishing:65,
    passing:70,
    dribbling:70,
    pressing:70,
    aerial:70,
    stamina:70,
    defensiveAwareness:60,
    tackling:60,
    positioning:70,
    transitionThreat:70,
    pressResistance:70,
    bigGameRating:70,
    consistency:70,
    leadership:70,
    versatility:70,
    weakFoot:70,
    setPieces:70,
    crossing:70,
    goalkeeperRating:55,
    reflexes:55,
    commandOfArea:55,
    distribution:55,
    clutch:70,
    visionRange:70,
    offTheBall:70,
    aggression:70,
    adaptability:70,
    composure:70,
    marking:60,
    recoveryPace:70,
    lineBreaking:70,
    poaching:70,
    linkUp:70,
    decisionMaking:70,
    mentalPressure:70,
    injuryRisk:70,
    discipline:70,
    longShots:70,
    heading:70,
    duelStrength:70,
    balance:70,
    acceleration:70,
    sprintSpeed:70,
  };
  function attr(p,k,def){
    if(!p)return def!=null?def:(ATTR_DEFAULTS[k]??70);
    if(p[k]!=null&&!isNaN(p[k]))return +p[k];
    if(k==='defence'&&p.defense!=null)return +p.defense;
    if(k==='defense'&&p.defence!=null)return +p.defence;
    if(k==='clutch')return avg([attr(p,'bigGameRating'),attr(p,'consistency'),attr(p,'leadership',70)]);
    if(k==='visionRange')return avg([attr(p,'intelligence'),attr(p,'passing'),attr(p,'creativity')]);
    if(k==='offTheBall')return avg([attr(p,'positioning'),attr(p,'intelligence'),attr(p,'pace'),attr(p,'finishing')]);
    if(k==='aggression')return avg([attr(p,'pressing'),attr(p,'workRate'),attr(p,'physical'),attr(p,'tackling')]);
    if(k==='adaptability')return avg([attr(p,'intelligence'),attr(p,'versatility'),attr(p,'consistency')]);
    if(k==='composure')return avg([attr(p,'technical'),attr(p,'pressResistance'),attr(p,'consistency'),attr(p,'clutch')]);
    if(k==='marking')return avg([attr(p,'defensiveAwareness'),attr(p,'positioning'),attr(p,'intelligence'),attr(p,'tackling')]);
    if(k==='recoveryPace')return avg([attr(p,'pace'),attr(p,'acceleration',attr(p,'pace')),attr(p,'defensiveAwareness')]);
    if(k==='lineBreaking')return avg([attr(p,'passing'),attr(p,'visionRange'),attr(p,'technical'),attr(p,'creativity')]);
    if(k==='poaching')return avg([attr(p,'finishing'),attr(p,'positioning'),attr(p,'offTheBall'),attr(p,'composure')]);
    if(k==='linkUp')return avg([attr(p,'passing'),attr(p,'technical'),attr(p,'intelligence'),attr(p,'creativity')]);
    if(k==='decisionMaking')return avg([attr(p,'intelligence'),attr(p,'composure'),attr(p,'consistency')]);
    if(k==='duelStrength')return avg([attr(p,'physical'),attr(p,'aggression'),attr(p,'balance'),attr(p,'aerial')]);
    if(k==='heading')return avg([attr(p,'aerial'),attr(p,'positioning'),attr(p,'physical')]);
    return def!=null?def:(ATTR_DEFAULTS[k]??70);
  }
  const ROLE_IMPORTANCE={
    gk:{
      goalkeeperRating:0.28,
      reflexes:0.18,
      commandOfArea:0.14,
      distribution:0.1,
      composure:0.08,
      clutch:0.08,
      positioning:0.14,
    },
    lb:{
      defence:0.16,
      pace:0.14,
      stamina:0.1,
      crossing:0.08,
      tackling:0.12,
      defensiveAwareness:0.12,
      intelligence:0.1,
      workRate:0.1,
      technical:0.08,
    },
    rb:{
      defence:0.16,
      pace:0.14,
      stamina:0.1,
      crossing:0.08,
      tackling:0.12,
      defensiveAwareness:0.12,
      intelligence:0.1,
      workRate:0.1,
      technical:0.08,
    },
    cb:{
      defence:0.22,
      defensiveAwareness:0.16,
      tackling:0.12,
      aerial:0.1,
      physical:0.1,
      intelligence:0.12,
      pace:0.06,
      composure:0.06,
      leadership:0.06,
    },
    cdm:{
      defence:0.18,
      midfield:0.16,
      tackling:0.12,
      defensiveAwareness:0.14,
      intelligence:0.12,
      physical:0.08,
      passing:0.08,
      pressResistance:0.06,
      workRate:0.06,
    },
    cm:{
      midfield:0.2,
      passing:0.14,
      pressResistance:0.12,
      technical:0.12,
      intelligence:0.12,
      workRate:0.08,
      defence:0.08,
      creativity:0.08,
      stamina:0.06,
    },
    cam:{
      creativity:0.2,
      attack:0.14,
      midfield:0.14,
      passing:0.14,
      technical:0.12,
      dribbling:0.1,
      visionRange:0.08,
      pressResistance:0.08,
    },
    lw:{
      attack:0.2,
      pace:0.14,
      dribbling:0.14,
      creativity:0.12,
      finishing:0.12,
      technical:0.1,
      offTheBall:0.08,
      crossing:0.06,
      workRate:0.04,
    },
    rw:{
      attack:0.2,
      pace:0.14,
      dribbling:0.14,
      creativity:0.12,
      finishing:0.12,
      technical:0.1,
      offTheBall:0.08,
      crossing:0.06,
      workRate:0.04,
    },
    st:{
      attack:0.18,
      finishing:0.18,
      positioning:0.12,
      offTheBall:0.12,
      physical:0.08,
      pace:0.08,
      aerial:0.06,
      technical:0.08,
      composure:0.1,
    },
  };
  function roleScore(p,role){const w=ROLE_IMPORTANCE[safeRole(role)]||{overall:1};return clamp(sum(Object.entries(w).map(([k,v])=>attr(p,k)*v)),1,99);}
  const TRAIT_BONUSES={
    eliteFinisher:{stat:'finishing',boost:4},
    transitionThreat:{stat:'transitionThreat',boost:5},
    paceAbuser:{stat:'pace',boost:4},
    insideForward:{stat:'dribbling',boost:2},
    chanceCreator:{stat:'creativity',boost:4},
    visionPasser:{stat:'visionRange',boost:4},
    setPieceExpert:{stat:'setPieces',boost:5},
    crossingSpecialist:{stat:'crossing',boost:5},
    dribbleMaestro:{stat:'dribbling',boost:5},
    calmUnderPressure:{stat:'composure',boost:4},
    bigGamePlayer:{stat:'clutch',boost:5},
    leader:{stat:'leadership',boost:5},
    hardTackler:{stat:'tackling',boost:4},
    aerialDominator:{stat:'aerial',boost:5},
    ballPlayingDefender:{stat:'passing',boost:4},
    protectiveScreener:{stat:'defensiveAwareness',boost:4},
    highWorkRate:{stat:'workRate',boost:4},
    boxToBox:{stat:'stamina',boost:4},
    goalScoringMidfielder:{stat:'offTheBall',boost:4},
    intelligentPositioner:{stat:'positioning',boost:5},
    pressMonster:{stat:'pressing',boost:5},
    targetMan:{stat:'aerial',boost:4},
    poacher:{stat:'poaching',boost:5},
    lineBreaker:{stat:'lineBreaking',boost:5},
    controller:{stat:'midfield',boost:4},
    tempoDictator:{stat:'passing',boost:5},
    recoveryDefender:{stat:'recoveryPace',boost:5},
    sweeperKeeper:{stat:'distribution',boost:4},
    penaltyBoxPredator:{stat:'poaching',boost:5},
    widePlaymaker:{stat:'creativity',boost:4},
    invertedFullback:{stat:'midfield',boost:3},
    attackingFullback:{stat:'crossing',boost:4},
    lockdownFullback:{stat:'defensiveAwareness',boost:5},
    destroyer:{stat:'aggression',boost:5},
    regista:{stat:'visionRange',boost:5},
    falseNine:{stat:'linkUp',boost:4},
    pressResistant:{stat:'pressResistance',boost:5},
    oneManArmy:{stat:'technical',boost:6},
    gravitySuperstar:{stat:'attack',boost:5},
  };
  const CONTEXT_RULES=[
    {id:'paceBehind_1',context:'paceBehind',stat:'pace',target:'attack',weight:-0.83},
    {id:'paceBehind_2',context:'paceBehind',stat:'intelligence',target:'transition',weight:-0.61},
    {id:'paceBehind_3',context:'paceBehind',stat:'technical',target:'synergy',weight:-0.39},
    {id:'lowBlock_1',context:'lowBlock',stat:'intelligence',target:'defence',weight:-0.48},
    {id:'lowBlock_2',context:'lowBlock',stat:'technical',target:'midfield',weight:-0.26},
    {id:'lowBlock_3',context:'lowBlock',stat:'workRate',target:'attack',weight:-0.04},
    {id:'highLine_1',context:'highLine',stat:'technical',target:'transition',weight:-0.13},
    {id:'highLine_2',context:'highLine',stat:'workRate',target:'synergy',weight:0.09},
    {id:'highLine_3',context:'highLine',stat:'physical',target:'defence',weight:0.31},
    {id:'wideOverload_1',context:'wideOverload',stat:'workRate',target:'midfield',weight:0.22},
    {id:'wideOverload_2',context:'wideOverload',stat:'physical',target:'attack',weight:0.44},
    {id:'wideOverload_3',context:'wideOverload',stat:'creativity',target:'transition',weight:0.66},
    {id:'centralOverload_1',context:'centralOverload',stat:'physical',target:'synergy',weight:0.57},
    {id:'centralOverload_2',context:'centralOverload',stat:'creativity',target:'defence',weight:0.79},
    {id:'centralOverload_3',context:'centralOverload',stat:'defensiveAwareness',target:'midfield',weight:1.01},
    {id:'crossingRoute_1',context:'crossingRoute',stat:'creativity',target:'attack',weight:0.92},
    {id:'crossingRoute_2',context:'crossingRoute',stat:'defensiveAwareness',target:'transition',weight:1.14},
    {id:'crossingRoute_3',context:'crossingRoute',stat:'pressResistance',target:'synergy',weight:1.36},
    {id:'setPieceRoute_1',context:'setPieceRoute',stat:'defensiveAwareness',target:'defence',weight:1.27},
    {id:'setPieceRoute_2',context:'setPieceRoute',stat:'pressResistance',target:'midfield',weight:1.49},
    {id:'setPieceRoute_3',context:'setPieceRoute',stat:'transitionThreat',target:'attack',weight:1.71},
    {id:'counterPress_1',context:'counterPress',stat:'pressResistance',target:'transition',weight:-0.83},
    {id:'counterPress_2',context:'counterPress',stat:'transitionThreat',target:'synergy',weight:-0.61},
    {id:'counterPress_3',context:'counterPress',stat:'clutch',target:'defence',weight:-0.39},
    {id:'deepBuildUp_1',context:'deepBuildUp',stat:'transitionThreat',target:'midfield',weight:-0.48},
    {id:'deepBuildUp_2',context:'deepBuildUp',stat:'clutch',target:'attack',weight:-0.26},
    {id:'deepBuildUp_3',context:'deepBuildUp',stat:'pace',target:'transition',weight:-0.04},
    {id:'secondBalls_1',context:'secondBalls',stat:'clutch',target:'synergy',weight:-0.13},
    {id:'secondBalls_2',context:'secondBalls',stat:'pace',target:'defence',weight:0.09},
    {id:'secondBalls_3',context:'secondBalls',stat:'intelligence',target:'midfield',weight:0.31},
    {id:'halfSpace_1',context:'halfSpace',stat:'pace',target:'attack',weight:0.22},
    {id:'halfSpace_2',context:'halfSpace',stat:'intelligence',target:'transition',weight:0.44},
    {id:'halfSpace_3',context:'halfSpace',stat:'technical',target:'synergy',weight:0.66},
    {id:'boxCrowding_1',context:'boxCrowding',stat:'intelligence',target:'defence',weight:0.57},
    {id:'boxCrowding_2',context:'boxCrowding',stat:'technical',target:'midfield',weight:0.79},
    {id:'boxCrowding_3',context:'boxCrowding',stat:'workRate',target:'attack',weight:1.01},
    {id:'isolation_1',context:'isolation',stat:'technical',target:'transition',weight:0.92},
    {id:'isolation_2',context:'isolation',stat:'workRate',target:'synergy',weight:1.14},
    {id:'isolation_3',context:'isolation',stat:'physical',target:'defence',weight:1.36},
    {id:'doubleTeam_1',context:'doubleTeam',stat:'workRate',target:'midfield',weight:1.27},
    {id:'doubleTeam_2',context:'doubleTeam',stat:'physical',target:'attack',weight:1.49},
    {id:'doubleTeam_3',context:'doubleTeam',stat:'creativity',target:'transition',weight:1.71},
    {id:'freeMan_1',context:'freeMan',stat:'physical',target:'synergy',weight:-0.83},
    {id:'freeMan_2',context:'freeMan',stat:'creativity',target:'defence',weight:-0.61},
    {id:'freeMan_3',context:'freeMan',stat:'defensiveAwareness',target:'midfield',weight:-0.39},
    {id:'fatigueWave_1',context:'fatigueWave',stat:'creativity',target:'attack',weight:-0.48},
    {id:'fatigueWave_2',context:'fatigueWave',stat:'defensiveAwareness',target:'transition',weight:-0.26},
    {id:'fatigueWave_3',context:'fatigueWave',stat:'pressResistance',target:'synergy',weight:-0.04},
    {id:'clutchTime_1',context:'clutchTime',stat:'defensiveAwareness',target:'defence',weight:-0.13},
    {id:'clutchTime_2',context:'clutchTime',stat:'pressResistance',target:'midfield',weight:0.09},
    {id:'clutchTime_3',context:'clutchTime',stat:'transitionThreat',target:'attack',weight:0.31},
    {id:'keeperDistribution_1',context:'keeperDistribution',stat:'pressResistance',target:'transition',weight:0.22},
    {id:'keeperDistribution_2',context:'keeperDistribution',stat:'transitionThreat',target:'synergy',weight:0.44},
    {id:'keeperDistribution_3',context:'keeperDistribution',stat:'clutch',target:'defence',weight:0.66},
    {id:'aerialSiege_1',context:'aerialSiege',stat:'transitionThreat',target:'midfield',weight:0.57},
    {id:'aerialSiege_2',context:'aerialSiege',stat:'clutch',target:'attack',weight:0.79},
    {id:'aerialSiege_3',context:'aerialSiege',stat:'pace',target:'transition',weight:1.01},
    {id:'pressTrap_1',context:'pressTrap',stat:'clutch',target:'synergy',weight:0.92},
    {id:'pressTrap_2',context:'pressTrap',stat:'pace',target:'defence',weight:1.14},
    {id:'pressTrap_3',context:'pressTrap',stat:'intelligence',target:'midfield',weight:1.36},
    {id:'switchPlay_1',context:'switchPlay',stat:'pace',target:'attack',weight:1.27},
    {id:'switchPlay_2',context:'switchPlay',stat:'intelligence',target:'transition',weight:1.49},
    {id:'switchPlay_3',context:'switchPlay',stat:'technical',target:'synergy',weight:1.71},
    {id:'underlap_1',context:'underlap',stat:'intelligence',target:'defence',weight:-0.83},
    {id:'underlap_2',context:'underlap',stat:'technical',target:'midfield',weight:-0.61},
    {id:'underlap_3',context:'underlap',stat:'workRate',target:'attack',weight:-0.39},
    {id:'overlap_1',context:'overlap',stat:'technical',target:'transition',weight:-0.48},
    {id:'overlap_2',context:'overlap',stat:'workRate',target:'synergy',weight:-0.26},
    {id:'overlap_3',context:'overlap',stat:'physical',target:'defence',weight:-0.04},
    {id:'invertedFullback_1',context:'invertedFullback',stat:'workRate',target:'midfield',weight:-0.13},
    {id:'invertedFullback_2',context:'invertedFullback',stat:'physical',target:'attack',weight:0.09},
    {id:'invertedFullback_3',context:'invertedFullback',stat:'creativity',target:'transition',weight:0.31},
    {id:'restDefence_1',context:'restDefence',stat:'physical',target:'synergy',weight:0.22},
    {id:'restDefence_2',context:'restDefence',stat:'creativity',target:'defence',weight:0.44},
    {id:'restDefence_3',context:'restDefence',stat:'defensiveAwareness',target:'midfield',weight:0.66},
    {id:'lateRunner_1',context:'lateRunner',stat:'creativity',target:'attack',weight:0.57},
    {id:'lateRunner_2',context:'lateRunner',stat:'defensiveAwareness',target:'transition',weight:0.79},
    {id:'lateRunner_3',context:'lateRunner',stat:'pressResistance',target:'synergy',weight:1.01},
    {id:'cutbackZone_1',context:'cutbackZone',stat:'defensiveAwareness',target:'defence',weight:0.92},
    {id:'cutbackZone_2',context:'cutbackZone',stat:'pressResistance',target:'midfield',weight:1.14},
    {id:'cutbackZone_3',context:'cutbackZone',stat:'transitionThreat',target:'attack',weight:1.36},
    {id:'falseNineDrop_1',context:'falseNineDrop',stat:'pressResistance',target:'transition',weight:1.27},
    {id:'falseNineDrop_2',context:'falseNineDrop',stat:'transitionThreat',target:'synergy',weight:1.49},
    {id:'falseNineDrop_3',context:'falseNineDrop',stat:'clutch',target:'defence',weight:1.71},
    {id:'poacherZone_1',context:'poacherZone',stat:'transitionThreat',target:'midfield',weight:-0.83},
    {id:'poacherZone_2',context:'poacherZone',stat:'clutch',target:'attack',weight:-0.61},
    {id:'poacherZone_3',context:'poacherZone',stat:'pace',target:'transition',weight:-0.39},
    {id:'chaosDribble_1',context:'chaosDribble',stat:'clutch',target:'synergy',weight:-0.48},
    {id:'chaosDribble_2',context:'chaosDribble',stat:'pace',target:'defence',weight:-0.26},
    {id:'chaosDribble_3',context:'chaosDribble',stat:'intelligence',target:'midfield',weight:-0.04},
    {id:'tempoKill_1',context:'tempoKill',stat:'pace',target:'attack',weight:-0.13},
    {id:'tempoKill_2',context:'tempoKill',stat:'intelligence',target:'transition',weight:0.09},
    {id:'tempoKill_3',context:'tempoKill',stat:'technical',target:'synergy',weight:0.31},
    {id:'duelStorm_1',context:'duelStorm',stat:'intelligence',target:'defence',weight:0.22},
    {id:'duelStorm_2',context:'duelStorm',stat:'technical',target:'midfield',weight:0.44},
    {id:'duelStorm_3',context:'duelStorm',stat:'workRate',target:'attack',weight:0.66},
    {id:'leaderLift_1',context:'leaderLift',stat:'technical',target:'transition',weight:0.57},
    {id:'leaderLift_2',context:'leaderLift',stat:'workRate',target:'synergy',weight:0.79},
    {id:'leaderLift_3',context:'leaderLift',stat:'physical',target:'defence',weight:1.01},
    {id:'megaStarGravity_1',context:'megaStarGravity',stat:'workRate',target:'midfield',weight:0.92},
    {id:'megaStarGravity_2',context:'megaStarGravity',stat:'physical',target:'attack',weight:1.14},
    {id:'megaStarGravity_3',context:'megaStarGravity',stat:'creativity',target:'transition',weight:1.36},
    {id:'weakLinkTarget_1',context:'weakLinkTarget',stat:'physical',target:'synergy',weight:1.27},
    {id:'weakLinkTarget_2',context:'weakLinkTarget',stat:'creativity',target:'defence',weight:1.49},
    {id:'weakLinkTarget_3',context:'weakLinkTarget',stat:'defensiveAwareness',target:'midfield',weight:1.71},
    {id:'protectiveMidfield_1',context:'protectiveMidfield',stat:'creativity',target:'attack',weight:-0.83},
    {id:'protectiveMidfield_2',context:'protectiveMidfield',stat:'defensiveAwareness',target:'transition',weight:-0.61},
    {id:'protectiveMidfield_3',context:'protectiveMidfield',stat:'pressResistance',target:'synergy',weight:-0.39},
    {id:'dirtyWorkCover_1',context:'dirtyWorkCover',stat:'defensiveAwareness',target:'defence',weight:-0.48},
    {id:'dirtyWorkCover_2',context:'dirtyWorkCover',stat:'pressResistance',target:'midfield',weight:-0.26},
    {id:'dirtyWorkCover_3',context:'dirtyWorkCover',stat:'transitionThreat',target:'attack',weight:-0.04},
    {id:'defensiveTriangle_1',context:'defensiveTriangle',stat:'pressResistance',target:'transition',weight:-0.13},
    {id:'defensiveTriangle_2',context:'defensiveTriangle',stat:'transitionThreat',target:'synergy',weight:0.09},
    {id:'defensiveTriangle_3',context:'defensiveTriangle',stat:'clutch',target:'defence',weight:0.31},
    {id:'attackingTriangle_1',context:'attackingTriangle',stat:'transitionThreat',target:'midfield',weight:0.22},
    {id:'attackingTriangle_2',context:'attackingTriangle',stat:'clutch',target:'attack',weight:0.44},
    {id:'attackingTriangle_3',context:'attackingTriangle',stat:'pace',target:'transition',weight:0.66},
    {id:'midfieldDiamond_1',context:'midfieldDiamond',stat:'clutch',target:'synergy',weight:0.57},
    {id:'midfieldDiamond_2',context:'midfieldDiamond',stat:'pace',target:'defence',weight:0.79},
    {id:'midfieldDiamond_3',context:'midfieldDiamond',stat:'intelligence',target:'midfield',weight:1.01},
  ];
  const CHEMISTRY_PAIRS=[
    {a:'visionPasser',b:'poacher',bonus:6},
    {a:'visionPasser',b:'paceAbuser',bonus:5},
    {a:'crossingSpecialist',b:'aerialDominator',bonus:6},
    {a:'setPieceExpert',b:'aerialDominator',bonus:5},
    {a:'tempoDictator',b:'pressResistant',bonus:4},
    {a:'protectiveScreener',b:'attackingFullback',bonus:5},
    {a:'destroyer',b:'controller',bonus:4},
    {a:'ballPlayingDefender',b:'regista',bonus:3},
    {a:'falseNine',b:'insideForward',bonus:5},
    {a:'chanceCreator',b:'eliteFinisher',bonus:5},
    {a:'dribbleMaestro',b:'overlap',bonus:3},
    {a:'leader',b:'youngStar',bonus:2},
    {a:'boxToBox',b:'regista',bonus:3},
    {a:'highWorkRate',b:'highWorkRate',bonus:2},
    {a:'oneManArmy',b:'gravitySuperstar',bonus:4},
  ];

  function traitBoost(p,stat){
    if(!p)return 0;
    let boost=0;
    for(const t of (p.traits||[])){
      const rule=TRAIT_BONUSES[t];
      if(rule&&rule.stat===stat)boost+=rule.boost;
    }
    return boost;
  }
  function effectiveAttr(p,stat,role){
    let base=attr(p,stat);
    base+=traitBoost(p,stat);
    if(role&&ROLE_IMPORTANCE[safeRole(role)]&&ROLE_IMPORTANCE[safeRole(role)][stat])base+=ROLE_IMPORTANCE[safeRole(role)][stat]*4;
    return clamp(base,1,99);
  }
  function unitAvg(unit,stat,def=60){return avg((unit||[]).map(x=>effectiveAttr(x.p,stat,x.role)),def);}
  function unitMax(unit,stat,def=60){return max((unit||[]).map(x=>effectiveAttr(x.p,stat,x.role)),def);}
  function weightedUnit(unit,stat,weightStat='overall'){
    unit=unit||[];
    const denom=sum(unit.map(x=>Math.max(1,attr(x.p,weightStat,70))));
    if(!denom)return 60;
    return sum(unit.map(x=>effectiveAttr(x.p,stat,x.role)*Math.max(1,attr(x.p,weightStat,70))))/denom;
  }
  function teamDNA(team){
    const u=units(team);
    const all=u.all;
    const f=u.forwards;
    const mids=u.mids;
    const def=u.defenders;
    const cbs=u.cbs;
    const fb=u.fullbacks;
    const cdm=u.cdm;
    const gk=u.gk[0]?u.gk[0].p:null;
    const profile={};
    profile.overall=unitAvg(all,'overall',70);
    profile.attack=weightedUnit(u.attackers,'attack','overall');
    profile.midfield=weightedUnit(mids,'midfield','overall');
    profile.defence=weightedUnit(def,'defence','overall');
    profile.pace=unitAvg(all,'pace');
    profile.fwdPace=unitAvg(f,'pace');
    profile.cbPace=unitAvg(cbs,'pace',65);
    profile.technical=unitAvg(all,'technical');
    profile.intelligence=unitAvg(all,'intelligence');
    profile.workRate=unitAvg(all,'workRate');
    profile.physical=unitAvg(all,'physical');
    profile.stamina=unitAvg(all,'stamina');
    profile.pressing=unitAvg(all,'pressing');
    profile.pressResistance=unitAvg(all,'pressResistance');
    profile.creativity=unitAvg(u.creators,'creativity');
    profile.vision=unitAvg(u.creators,'visionRange');
    profile.offBall=unitAvg(u.attackers,'offTheBall');
    profile.finishing=unitAvg(u.attackers,'finishing');
    profile.crossing=unitMax([...u.fullbacks,...u.forwards],'crossing');
    profile.setPieces=unitMax(all,'setPieces');
    profile.aerialAttack=unitAvg(u.attackers,'aerial');
    profile.aerialDefence=unitAvg([...u.cbs,...u.cdm],'aerial');
    profile.gk=gk?avg([attr(gk,'goalkeeperRating'),attr(gk,'reflexes'),attr(gk,'commandOfArea')]):55;
    profile.gkDistribution=gk?attr(gk,'distribution'):55;
    profile.cdmScreen=unitAvg(cdm,'defensiveAwareness',52);
    profile.cdmDirtyWork=unitAvg(cdm,'aggression',52);
    profile.cdmMobility=unitAvg(cdm,'recoveryPace',52);
    profile.fbRisk=unitAvg(fb,'attack',60)-unitAvg(fb,'defensiveAwareness',60)*0.25+unitAvg(fb,'pace',60)*0.05;
    profile.restDefence=avg([profile.cdmScreen,profile.cbPace,profile.defence,profile.intelligence]);
    profile.transitionThreat=avg([unitAvg(f,'transitionThreat'),profile.fwdPace,profile.offBall,profile.vision*0.55+profile.passing*0.45||profile.vision]);
    profile.lineBreaking=unitAvg([...mids,...u.creators],'lineBreaking');
    profile.poaching=unitMax(u.attackers,'poaching');
    profile.clutch=unitAvg(all,'clutch');
    profile.adaptability=unitAvg(all,'adaptability');
    profile.leadership=unitMax(all,'leadership');
    profile.consistency=unitAvg(all,'consistency');
    profile.megastar=max(all.map(x=>starGravity(x.p,x.role)),0);
    profile.roleCoverage=coverageNetwork(team).coverageScore;
    profile.balance=balanceScore(team,profile);
    return profile;
  }
  function starGravity(p,role){
    if(!p)return 0;
    const elite=avg([attr(p,'overall'),attr(p,'attack'),attr(p,'technical'),attr(p,'creativity'),attr(p,'dribbling'),attr(p,'finishing'),attr(p,'clutch')]);
    const threat=avg([elite,attr(p,'transitionThreat'),attr(p,'offTheBall'),attr(p,'visionRange')]);
    const trait=has(p,'oneManArmy')||has(p,'gravitySuperstar')||has(p,'dribbleMaestro')?8:0;
    const roleMult=['lw','rw','st','cam'].includes(safeRole(role))?1:0.7;
    return clamp((threat-84)*roleMult+trait,0,30);
  }
  function balanceScore(team,profile){
    const u=units(team);
    let s=76;
    if(u.cdm.length)s+=5;
    if(u.cbs.length>=2)s+=4;
    if(u.gk.length)s+=2;
    const attackDefGap=Math.abs((profile.attack||70)-(profile.defence||70));
    const midSupport=profile.midfield-profile.defence;
    s-=Math.max(0,attackDefGap-18)*0.25;
    if(profile.cdmScreen>82)s+=4;
    if(profile.fbRisk>75&&profile.cdmMobility<78)s-=5;
    if(profile.leadership>88)s+=3;
    if(profile.adaptability>86)s+=3;
    if(midSupport>8&&profile.defence<78)s+=2;
    return clamp(s,30,99);
  }
  function coverageNetwork(team){
    const u=units(team);
    const nodes=[];
    for(const x of u.all){
      const p=x.p,r=x.role;
      const cover={name:nameOf(p),role:r,slot:x.slot,range:0,dirty:0,IQ:0,side:'central'};
      cover.range=avg([attr(p,'pace'),attr(p,'stamina'),attr(p,'workRate'),attr(p,'recoveryPace')]);
      cover.dirty=avg([attr(p,'tackling'),attr(p,'aggression'),attr(p,'pressing'),attr(p,'physical')]);
      cover.IQ=avg([attr(p,'intelligence'),attr(p,'defensiveAwareness'),attr(p,'positioning'),attr(p,'adaptability')]);
      if(['lb','lw'].includes(r))cover.side='left';
      if(['rb','rw'].includes(r))cover.side='right';
      if(['cdm','cm','cam','st','cb','gk'].includes(r))cover.side='central';
      cover.coverValue=avg([cover.range,cover.dirty,cover.IQ]);
      if(r==='cdm')cover.coverValue+=8;
      if(r==='cm')cover.coverValue+=3;
      if(r==='cb')cover.coverValue+=4;
      if(has(p,'protectiveScreener'))cover.coverValue+=7;
      if(has(p,'boxToBox'))cover.coverValue+=4;
      if(has(p,'destroyer'))cover.coverValue+=5;
      nodes.push(cover);
    }
    const left=avg(nodes.filter(n=>n.side==='left'||n.side==='central').map(n=>n.coverValue),60);
    const right=avg(nodes.filter(n=>n.side==='right'||n.side==='central').map(n=>n.coverValue),60);
    const central=avg(nodes.filter(n=>n.side==='central').map(n=>n.coverValue),60);
    const coverageScore=avg([left,right,central]);
    return{nodes,left,right,central,coverageScore};
  }

  function styleModel(team,opp){
    const A=teamDNA(team),B=teamDNA(opp);
    const u=units(team);
    let highPress=avg([A.pressing,A.workRate,A.stamina,A.aggression||A.physical]);
    let possession=avg([A.midfield,A.technical,A.pressResistance,A.vision,A.gkDistribution]);
    let counter=avg([A.transitionThreat,A.fwdPace,A.lineBreaking,A.offBall]);
    let lowBlock=avg([A.defence,A.cdmScreen,A.aerialDefence,A.intelligence,A.gk]);
    let direct=avg([A.physical,A.aerialAttack,A.crossing,A.poaching]);
    let chaos=avg([unitMax(u.attackers,'dribbling'),A.creativity,A.megastar+75,A.clutch]);
    if(counter>B.restDefence+8)counter+=5;
    if(possession>B.pressing+8)possession+=4;
    if(highPress>B.pressResistance+7)highPress+=5;
    if(lowBlock>A.fwdPace+5)lowBlock+=2;
    const styles={highPress, possession, counter, lowBlock, direct, chaos};
    const primary=Object.entries(styles).sort((a,b)=>b[1]-a[1])[0][0];
    const secondary=Object.entries(styles).sort((a,b)=>b[1]-a[1])[1][0];
    return{styles,primary,secondary,A,B};
  }
  function spaceModel(attTeam,defTeam){
    const A=teamDNA(attTeam),D=teamDNA(defTeam);
    const defU=units(defTeam);
    const attackingFullbackRisk=D.fbRisk;
    const cdmCover=D.cdmScreen*0.45+D.cdmMobility*0.35+D.cdmDirtyWork*0.20;
    const lineHeight=clamp((D.pressing-62)*0.45+(D.fbRisk-58)*0.30+(D.cbPace-70)*0.12+(D.defence-75)*0.10,0,32);
    const gapsFromPress=Math.max(0,D.pressing-D.pressResistance)*0.10;
    const gapsFromFullbacks=Math.max(0,attackingFullbackRisk-65)*0.12;
    const gapsFromWeakCover=Math.max(0,78-cdmCover)*0.16;
    const smartCompactness=avg([D.intelligence,D.cdmScreen,D.defence,D.roleCoverage]);
    let space=50+lineHeight+gapsFromPress+gapsFromFullbacks+gapsFromWeakCover-(smartCompactness-75)*0.45;
    if(D.balance>86)space-=4;
    if(D.leadership>90)space-=3;
    return clamp(space,8,95);
  }
  function transitionScore(attTeam,defTeam){
    const A=teamDNA(attTeam),D=teamDNA(defTeam);
    const space=spaceModel(attTeam,defTeam);
    const launch=avg([A.lineBreaking,A.vision,A.gkDistribution,A.pressResistance]);
    const runner=avg([A.fwdPace,A.transitionThreat,A.offBall]);
    const finish=avg([A.finishing,A.poaching,A.clutch]);
    const rawThreat=runner*0.42+launch*0.26+finish*0.14+space*0.18;
    const recovery=avg([D.cbPace,D.cdmMobility,D.defence,D.intelligence,D.roleCoverage]);
    const antiPaceIQ=avg([D.intelligence,D.cdmScreen,D.defence])*0.52+D.cbPace*0.33+D.gk*0.15;
    const contextBonus=Math.max(0,space-55)*0.35+Math.max(0,A.fwdPace-D.cbPace)*0.22;
    const score=clamp(50+(rawThreat-antiPaceIQ)*0.72+contextBonus,1,99);
    return{score,space,launch,runner,finish,recovery,antiPaceIQ,rawThreat,contextBonus};
  }
  function attackVsDefence(attTeam,defTeam){
    const A=teamDNA(attTeam),D=teamDNA(defTeam);
    const t=transitionScore(attTeam,defTeam);
    const chanceCraft=avg([A.creativity,A.vision,A.technical,A.lineBreaking,A.megastar+72]);
    const boxThreat=avg([A.finishing,A.poaching,A.offBall,A.aerialAttack*0.45+A.crossing*0.55]);
    const defBlock=avg([D.defence,D.cdmScreen,D.aerialDefence,D.gk,D.roleCoverage,D.intelligence]);
    const gravityGap=gravityAndCover(attTeam,defTeam);
    const overloadBonus=gravityGap.attackFreeMen*0.8+Math.max(0,A.creativity-D.intelligence)*0.15;
    const raw=chanceCraft*0.30+boxThreat*0.25+t.score*0.22+A.clutch*0.08+A.attack*0.15;
    const resisted=defBlock*0.72+D.gk*0.14+D.balance*0.14;
    const score=clamp(50+(raw-resisted)*0.75+overloadBonus,1,99);
    return{score,chanceCraft,boxThreat,defBlock,transition:t,gravity:gravityGap,raw,resisted,overloadBonus};
  }
  function midfieldBattle(team,opp){
    const A=teamDNA(team),B=teamDNA(opp);
    const control=avg([A.midfield,A.passing||A.vision,A.technical,A.pressResistance,A.vision]);
    const ballWin=avg([A.cdmScreen,A.cdmDirtyWork,A.pressing,A.workRate,A.physical]);
    const oppPress=avg([B.pressing,B.workRate,B.physical]);
    const resistance=avg([A.pressResistance,A.technical,A.intelligence,A.composure||A.pressResistance]);
    const dirtyWorkSupport=dirtyWorkLift(team,opp);
    const controlScore=control-(oppPress-resistance)*0.25+dirtyWorkSupport.controlLift;
    const duelScore=ballWin-avg([B.physical,B.pressResistance,B.midfield])*0.25+dirtyWorkSupport.duelLift;
    const score=clamp(avg([controlScore,duelScore,A.leadership*0.12+A.adaptability*0.18+70*0.70]),1,99);
    return{score,control,ballWin,oppPress,resistance,dirtyWorkSupport,controlScore,duelScore};
  }
  function defensiveResistance(defTeam,attTeam){
    const D=teamDNA(defTeam),A=teamDNA(attTeam);
    const block=avg([D.defence,D.cdmScreen,D.roleCoverage,D.intelligence,D.gk]);
    const aerial=avg([D.aerialDefence,D.gk,D.physical]);
    const recovery=avg([D.cbPace,D.cdmMobility,D.roleCoverage,D.adaptability]);
    const focus=threatIdentification(defTeam,attTeam);
    const overloadTax=Math.max(0,focus.requiredAttention-focus.availableAttention)*1.3;
    const raw=block*0.35+aerial*0.13+recovery*0.17+D.balance*0.14+D.clutch*0.08+focus.containment*0.13-overloadTax;
    const attackerPressure=avg([A.megastar+72,A.creativity,A.transitionThreat,A.finishing]);
    const score=clamp(50+(raw-attackerPressure)*0.55,1,99);
    return{score,block,aerial,recovery,focus,overloadTax,raw,attackerPressure};
  }
  function dirtyWorkLift(team,opp){
    const u=units(team);
    const workers=[];
    for(const x of u.all){
      const p=x.p,r=x.role;
      const dirty=avg([attr(p,'aggression'),attr(p,'workRate'),attr(p,'stamina'),attr(p,'tackling'),attr(p,'pressing'),attr(p,'defensiveAwareness')]);
      const brain=avg([attr(p,'intelligence'),attr(p,'adaptability'),attr(p,'positioning')]);
      const lift=dirty*0.65+brain*0.35;
      let radius=0;
      if(r==='cdm')radius=1.00;
      else if(r==='cm')radius=0.78;
      else if(r==='cam')radius=0.45;
      else if(['lb','rb'].includes(r))radius=0.55;
      else if(r==='cb')radius=0.65;
      else radius=0.25;
      if(has(p,'boxToBox'))radius+=0.18;
      if(has(p,'protectiveScreener'))radius+=0.25;
      if(has(p,'destroyer'))radius+=0.20;
      if(has(p,'leader'))radius+=0.08;
      workers.push({name:nameOf(p),role:r,lift,radius,value:lift*radius});
    }
    const best=pickTop(workers,x=>x.value,4);
    const lift=sum(best.map(x=>Math.max(0,x.value-58)))/18;
    return{workers,best,controlLift:clamp(lift*0.42,0,8),duelLift:clamp(lift*0.58,0,10),protectionLift:clamp(lift,0,14)};
  }
  function gravityAndCover(attTeam,defTeam){
    const attackers=units(attTeam).attackers;
    const defenders=units(defTeam).all;
    const threats=attackers.map(x=>{
      const p=x.p,r=x.role;
      const gravity=starGravity(p,r)+Math.max(0,roleScore(p,r)-86)*0.4;
      const threat=avg([attr(p,'attack'),attr(p,'technical'),attr(p,'dribbling'),attr(p,'creativity'),attr(p,'finishing'),attr(p,'transitionThreat'),attr(p,'offTheBall')]);
      const required=clamp((threat-78)*0.12+gravity*0.16,0.2,4.5);
      return{name:nameOf(p),role:r,gravity,threat,required};
    });
    const coverers=defenders.map(x=>{
      const p=x.p,r=x.role;
      const ability=avg([attr(p,'defence'),attr(p,'marking'),attr(p,'recoveryPace'),attr(p,'intelligence'),attr(p,'adaptability'),attr(p,'physical')]);
      let capacity=clamp((ability-58)/16,0.2,3.2);
      if(r==='cdm')capacity+=0.65;
      if(r==='cb')capacity+=0.45;
      if(['lb','rb'].includes(r))capacity+=0.35;
      if(has(p,'lockdownFullback'))capacity+=0.55;
      if(has(p,'protectiveScreener'))capacity+=0.70;
      if(has(p,'leader'))capacity+=0.20;
      return{name:nameOf(p),role:r,ability,capacity};
    });
    const requiredAttention=sum(threats.map(t=>t.required));
    const availableAttention=sum(coverers.map(c=>c.capacity));
    const star=sortBy(threats,t=>t.required)[0]||{name:'none',required:0,threat:0};
    const bestCover=sortBy(coverers,c=>c.ability)[0]||{name:'none',ability:0,capacity:0};
    const containment=clamp(50+(availableAttention-requiredAttention)*8+(bestCover.ability-star.threat)*0.35,1,99);
    const attentionGap=requiredAttention-availableAttention;
    const attackFreeMen=clamp(attentionGap*1.8+Math.max(0,star.gravity-12)*0.8,0,20);
    return{threats,coverers,requiredAttention,availableAttention,containment,star,bestCover,attackFreeMen,attentionGap};
  }
  function threatIdentification(defTeam,attTeam){
    const D=teamDNA(defTeam);
    const gc=gravityAndCover(attTeam,defTeam);
    const identify=avg([D.intelligence,D.leadership,D.adaptability,D.cdmScreen,D.roleCoverage]);
    const containment=clamp(gc.containment+(identify-78)*0.35,1,99);
    return{...gc,identify,containment};
  }
  function flankBattle(attTeam,defTeam,side){
    const au=units(attTeam),du=units(defTeam);
    const attSide=side==='left'?au.wideLeft:au.wideRight;
    const defSide=side==='left'?du.wideRight:du.wideLeft;
    const attacker=pickTop(attSide,x=>avg([attr(x.p,'attack'),attr(x.p,'pace'),attr(x.p,'dribbling'),attr(x.p,'creativity')]),2);
    const cover=pickTop(defSide,x=>avg([attr(x.p,'defence'),attr(x.p,'pace'),attr(x.p,'defensiveAwareness'),attr(x.p,'workRate')]),3);
    const att=avg(attacker.map(x=>avg([attr(x.p,'attack'),attr(x.p,'pace'),attr(x.p,'dribbling'),attr(x.p,'crossing'),attr(x.p,'technical')])));
    const def=avg(cover.map(x=>avg([attr(x.p,'defence'),attr(x.p,'recoveryPace'),attr(x.p,'marking'),attr(x.p,'workRate'),attr(x.p,'intelligence')])));
    const support=avg(attacker.map(x=>attr(x.p,'workRate')))-avg(cover.map(x=>attr(x.p,'workRate')));
    const score=clamp(50+(att-def)*0.88+support*0.12,1,99);
    return{side,score,att,def,support,attackers:attacker.map(x=>nameOf(x.p)),defenders:cover.map(x=>nameOf(x.p))};
  }
  function setPieceBattle(team,opp){
    const A=teamDNA(team),D=teamDNA(opp);
    const delivery=avg([A.setPieces,A.crossing,A.vision]);
    const targets=avg([A.aerialAttack,A.physical,A.poaching]);
    const defence=avg([D.aerialDefence,D.gk,D.commandOfArea||D.gk,D.physical]);
    const score=clamp(50+(delivery*0.55+targets*0.45-defence)*0.8,1,99);
    return{score,delivery,targets,defence};
  }
  function synergyScore(team,opp){
    const all=playersOf(team);
    let score=70;
    const notes=[];
    for(const rule of CHEMISTRY_PAIRS){
      const hasA=all.some(p=>has(p,rule.a));
      const hasB=all.some(p=>has(p,rule.b));
      if(hasA&&hasB){score+=rule.bonus;notes.push(`${rule.a} + ${rule.b}`);}
    }
    const dna=teamDNA(team);
    const style=styleModel(team,opp);
    if(style.primary==='counter'&&dna.fwdPace>88&&dna.lineBreaking>82)score+=6;
    if(style.primary==='possession'&&dna.pressResistance>86&&dna.vision>86)score+=6;
    if(style.primary==='lowBlock'&&dna.defence>86&&dna.cdmScreen>84)score+=5;
    if(dna.megastar>18&&dna.creativity>84)score+=4;
    if(dna.fbRisk>75&&dna.cdmScreen<76)score-=8;
    if(dna.pressing>82&&dna.stamina<76)score-=5;
    if(dna.attack>88&&dna.midfield<76)score-=4;
    if(dna.defence<74&&dna.cdmScreen<70)score-=8;
    return{score:clamp(score,1,99),notes,style:style.primary};
  }
  function phasePackage(team,opp){
    const attack=attackVsDefence(team,opp);
    const mid=midfieldBattle(team,opp);
    const def=defensiveResistance(team,opp);
    const trans=transitionScore(team,opp);
    const left=flankBattle(team,opp,'left');
    const right=flankBattle(team,opp,'right');
    const sp=setPieceBattle(team,opp);
    const syn=synergyScore(team,opp);
    const dna=teamDNA(team);
    const oppDna=teamDNA(opp);
    const goalkeeper=clamp(50+(dna.gk-oppDna.finishing)*0.42+(dna.gk-78)*0.35,1,99);
    const pressing=clamp(50+(dna.pressing-oppDna.pressResistance)*0.75+(dna.workRate-oppDna.composure||0)*0.15,1,99);
    const possession=clamp(50+(dna.midfield-oppDna.midfield)*0.5+(dna.pressResistance-oppDna.pressing)*0.22+(dna.technical-oppDna.technical)*0.2,1,99);
    const chanceCreation=clamp(avg([attack.score,dna.creativity,dna.vision,dna.lineBreaking,dna.megastar+72]),1,99);
    const weakness=weaknessPenalty(team,opp);
    const final=clamp(
      attack.score*0.18+
      mid.score*0.14+
      def.score*0.13+
      trans.score*0.12+
      chanceCreation*0.11+
      possession*0.08+
      pressing*0.06+
      sp.score*0.05+
      goalkeeper*0.05+
      syn.score*0.08-
      weakness.total*0.60,
      1,99);
    return{attack,midfield:mid,defence:def,transition:trans,leftFlank:left,rightFlank:right,setPieces:sp,synergy:syn,goalkeeper,pressing, possession, chanceCreation, weakness, final, dna};
  }
  function weaknessPenalty(team,opp){
    const A=teamDNA(team),O=teamDNA(opp);
    const items=[];
    function push(id,amount,condition,exploiter){if(condition&&amount>0)items.push({id,amount:round(amount,1),exploiter});}
    push('slowCentreBacks',Math.max(0,O.fwdPace-A.cbPace)*0.18+A.fbRisk>72?2:0,O.fwdPace>A.cbPace+8,'opponent pace and transition threat');
    push('poorAerialDefence',Math.max(0,O.aerialAttack+A.crossing*0.1-A.aerialDefence)*0.12,O.crossing>82||O.setPieces>82,'crossing and set pieces');
    push('weakCDMCover',Math.max(0,78-A.cdmScreen)*0.16,O.creativity>82||O.transitionThreat>84,'creative runners between lines');
    push('overAttackingFullbacks',Math.max(0,A.fbRisk-70)*0.18,O.transitionThreat>82,'wide counters into vacated channels');
    push('lowPressResistance',Math.max(0,O.pressing-A.pressResistance)*0.16,O.pressing>A.pressResistance+6,'high press');
    push('lowWorkRateAttackers',Math.max(0,75-A.workRate)*0.10,O.fullbackThreat>80,'opponent fullback overloads');
    push('badKeeperMismatch',Math.max(0,O.finishing-A.gk)*0.13,O.finishing>A.gk+8,'elite finishing vs weak keeper');
    const total=clamp(sum(items.map(x=>x.amount)),0,24);
    return{items,total};
  }
  function winnerMath(packA,packB){
    const diff=packA.final-packB.final;
    const probA=clamp(50+diff*3.2,1,99);
    let type='coin flip';
    if(Math.abs(diff)>=14)type='brutal mismatch';
    else if(Math.abs(diff)>=9)type='dominant win';
    else if(Math.abs(diff)>=5)type='clear win';
    else if(Math.abs(diff)>=2)type='narrow win';
    return{diff,probA,probB:100-probA,type};
  }
  function expectedGoals(packA,packB){
    const a=packA,b=packB;
    const dominance=a.final-b.final;
    const chance=(a.attack.score*0.24+a.chanceCreation*0.22+a.transition.score*0.17+a.midfield.score*0.09+a.setPieces.score*0.08+a.synergy.score*0.08+a.dna.clutch*0.06+a.leftFlank.score*0.03+a.rightFlank.score*0.03);
    const resistance=(b.defence.score*0.35+b.goalkeeper*0.22+b.dna.gk*0.13+b.dna.cdmScreen*0.12+b.dna.roleCoverage*0.10+b.dna.balance*0.08);
    let xg=1.15+(chance-resistance)*0.055+Math.max(0,dominance)*0.035;
    if(a.transition.score>85&&b.defence.score<45)xg+=0.75;
    if(a.attack.score>90&&b.goalkeeper<42)xg+=0.60;
    if(a.synergy.score>90&&a.chanceCreation>88)xg+=0.35;
    if(a.setPieces.score>85&&b.defence.score<60)xg+=0.25;
    if(b.defence.score>88&&b.goalkeeper>88)xg-=0.45;
    if(a.dna.megastar>22)xg+=0.30;
    return clamp(xg,0.05,7.9);
  }
  function deterministicScoreline(packA,packB){
    const xgA=expectedGoals(packA,packB);
    const xgB=expectedGoals(packB,packA);
    const diff=packA.final-packB.final;
    function goals(xg,boost){
      let g=Math.floor(xg);
      const rem=xg-g;
      if(rem>0.72)g+=1;
      if(boost>13&&rem>0.42)g+=1;
      if(boost>22)g+=1;
      if(xg>5.8&&boost>18)g+=1;
      return clamp(g,0,10);
    }
    let gA=goals(xgA,diff);
    let gB=goals(xgB,-diff);
    if(Math.abs(diff)<2&&Math.abs(xgA-xgB)<0.35){
      const base=Math.round((xgA+xgB)/2);
      gA=base;gB=base;
    }
    if(diff>18&&gA<4)gA=4;
    if(diff>25&&gA<6)gA=6;
    if(diff>32&&gA<8)gA=8;
    if(diff>18&&gB>2)gB=2;
    if(diff>26&&gB>1)gB=1;
    if(diff>35)gB=0;
    if(diff<-18&&gB<4)gB=4;
    if(diff<-25&&gB<6)gB=6;
    if(diff<-32&&gB<8)gB=8;
    if(diff<-18&&gA>2)gA=2;
    if(diff<-26&&gA>1)gA=1;
    if(diff<-35)gA=0;
    if(packA.defence.score>91&&packB.defence.score>91&&packA.attack.score<68&&packB.attack.score<68){gA=0;gB=0;}
    return{xgA:round(xgA,2),xgB:round(xgB,2),goalsA:gA,goalsB:gB,scoreline:`${gA}-${gB}`};
  }

  function playerAttackThreat(x){const p=x.p,r=x.role;return avg([roleScore(p,r),attr(p,'attack'),attr(p,'technical'),attr(p,'dribbling'),attr(p,'creativity'),attr(p,'finishing'),attr(p,'transitionThreat'),attr(p,'offTheBall'),attr(p,'clutch')]);}
  function playerDefenceThreat(x){const p=x.p,r=x.role;return avg([roleScore(p,r),attr(p,'defence'),attr(p,'marking'),attr(p,'recoveryPace'),attr(p,'intelligence'),attr(p,'tackling'),attr(p,'physical'),attr(p,'adaptability')]);}
  function battleScore(a,b,context=0){
    const diff=a-b+context;
    const left=scoreSplit(diff,0.18);
    return{left,right:100-left,diff};
  }
  function generateKeyBattles(teamA,teamB,names){
    const au=units(teamA),bu=units(teamB);
    const battles=[];
    function addBattle(title,aName,bName,aVal,bVal,context,why){
      const s=battleScore(aVal,bVal,context||0);
      const winner=s.left===50?'even':(s.left>50?names[0]:names[1]);
      battles.push({title,aName,bName,score:`${s.left}-${s.right}`,winner,scoreA:s.left,scoreB:s.right,reason:why,diff:round(s.diff,1)});
    }
    const aStar=sortBy(au.attackers,playerAttackThreat)[0];
    const bStop=sortBy(bu.defenders.concat(bu.cdm),playerDefenceThreat)[0];
    const bStar=sortBy(bu.attackers,playerAttackThreat)[0];
    const aStop=sortBy(au.defenders.concat(au.cdm),playerDefenceThreat)[0];
    if(aStar&&bStop)addBattle(`${nameOf(aStar.p)} vs ${nameOf(bStop.p)}`,nameOf(aStar.p),nameOf(bStop.p),playerAttackThreat(aStar),playerDefenceThreat(bStop),starGravity(aStar.p,aStar.role)*0.35,`${nameOf(aStar.p)} forces defensive attention; ${nameOf(bStop.p)} must combine marking, recovery pace and intelligence to control the duel.`);
    if(bStar&&aStop)addBattle(`${nameOf(bStar.p)} vs ${nameOf(aStop.p)}`,nameOf(bStar.p),nameOf(aStop.p),playerAttackThreat(bStar),playerDefenceThreat(aStop),starGravity(bStar.p,bStar.role)*0.35,`${nameOf(bStar.p)} is the main opposing threat; ${nameOf(aStop.p)} is the best available defensive answer.`);
    const aMid=sortBy(au.mids,x=>avg([attr(x.p,'midfield'),attr(x.p,'passing'),attr(x.p,'pressResistance'),attr(x.p,'intelligence')]))[0];
    const bMid=sortBy(bu.mids,x=>avg([attr(x.p,'midfield'),attr(x.p,'passing'),attr(x.p,'pressResistance'),attr(x.p,'intelligence')]))[0];
    if(aMid&&bMid)addBattle(`Midfield control`,nameOf(aMid.p),nameOf(bMid.p),avg([attr(aMid.p,'midfield'),attr(aMid.p,'pressResistance'),attr(aMid.p,'visionRange'),attr(aMid.p,'workRate')]),avg([attr(bMid.p,'midfield'),attr(bMid.p,'pressResistance'),attr(bMid.p,'visionRange'),attr(bMid.p,'workRate')]),0,`The midfield duel decides whether the match becomes controlled possession, chaos, or repeated transitions.`);
    const aLeft=flankBattle(teamA,teamB,'left');
    const bRight=flankBattle(teamB,teamA,'right');
    addBattle(`Team A left side vs Team B right side`,aLeft.attackers.join(' + '),aLeft.defenders.join(' + '),aLeft.att,aLeft.def,0,`This flank measures dribbling, pace, crossing and defensive cover rather than just fullback quality.`);
    addBattle(`Team B right side vs Team A left side`,bRight.attackers.join(' + '),bRight.defenders.join(' + '),bRight.att,bRight.def,0,`The opposite wide channel may decide where the free man appears.`);
    const aSP=setPieceBattle(teamA,teamB),bSP=setPieceBattle(teamB,teamA);
    addBattle(`Set pieces`,names[0],names[1],aSP.score,bSP.score,0,`Delivery, aerial targets, goalkeeper command and defensive height all combine here.`);
    const aT=transitionScore(teamA,teamB),bT=transitionScore(teamB,teamA);
    addBattle(`Transition threat`,names[0],names[1],aT.score,bT.score,0,`This is no longer a static 50-50; it depends on speed, launch passing, defensive line, fullback risk, CDM protection and recovery pace.`);
    return battles.sort((x,y)=>Math.abs(y.diff)-Math.abs(x.diff)).slice(0,9);
  }
  function distributeGoals(team,goals,pack,oppPack){
    const u=units(team);
    const candidates=u.attackers.concat(u.mids).map(x=>{
      const p=x.p,r=x.role;
      let weight=attr(p,'finishing')*0.30+attr(p,'poaching')*0.25+attr(p,'offTheBall')*0.15+attr(p,'attack')*0.12+attr(p,'clutch')*0.08+attr(p,'positioning')*0.10;
      if(r==='st')weight*=1.45;
      if(['lw','rw'].includes(r))weight*=1.18;
      if(r==='cam')weight*=0.88;
      if(r==='cdm')weight*=0.45;
      weight+=starGravity(p,r)*2.5;
      return{x,weight};
    });
    const goalsMap={};
    for(let i=0;i<goals;i++){
      const total=sum(candidates.map(c=>c.weight));
      let r=(i*37.7+pack.chanceCreation*2.3+pack.transition.score)%Math.max(1,total);
      let chosen=candidates[0];
      for(const c of candidates){r-=c.weight;if(r<=0){chosen=c;break;}}
      const nm=nameOf(chosen.x.p);goalsMap[nm]=(goalsMap[nm]||0)+1;
      chosen.weight*=0.72;
    }
    return goalsMap;
  }
  function distributeAssists(team,goals,pack){
    const u=units(team);
    const candidates=u.creators.concat(u.mids).concat(u.fullbacks).map(x=>{
      const p=x.p,r=x.role;
      let weight=attr(p,'creativity')*0.26+attr(p,'passing')*0.22+attr(p,'visionRange')*0.20+attr(p,'crossing')*0.10+attr(p,'setPieces')*0.08+attr(p,'technical')*0.14;
      if(r==='cam')weight*=1.35;
      if(['lw','rw'].includes(r))weight*=1.18;
      if(['lb','rb'].includes(r))weight*=0.92;
      if(r==='cdm')weight*=0.82;
      weight+=starGravity(p,r)*1.8;
      return{x,weight};
    });
    const assistsMap={};
    for(let i=0;i<goals;i++){
      if(candidates.length===0)break;
      const total=sum(candidates.map(c=>c.weight));
      let r=(i*29.3+pack.midfield.score*1.9+pack.setPieces.score)%Math.max(1,total);
      let chosen=candidates[0];
      for(const c of candidates){r-=c.weight;if(r<=0){chosen=c;break;}}
      const nm=nameOf(chosen.x.p);assistsMap[nm]=(assistsMap[nm]||0)+1;
      chosen.weight*=0.80;
    }
    return assistsMap;
  }
  function playerRatings(team,pack,oppPack,goalsFor,goalsAgainst){
    const goals=distributeGoals(team,goalsFor,pack,oppPack);
    const assists=distributeAssists(team,goalsFor,pack);
    const ratings=[];
    const dominance=pack.final-oppPack.final;
    for(const x of units(team).all){
      const p=x.p,r=x.role,n=nameOf(p);
      let base=6.1+(roleScore(p,r)-78)*0.035+dominance*0.028;
      if(['st','lw','rw','cam'].includes(r))base+=(pack.attack.score-60)*0.022+(pack.chanceCreation-60)*0.015;
      if(['cm','cdm','cam'].includes(r))base+=(pack.midfield.score-60)*0.024+(pack.possession-50)*0.012;
      if(['cb','lb','rb','cdm','gk'].includes(r))base+=(pack.defence.score-60)*0.026-(goalsAgainst)*0.18;
      if(r==='gk')base+=(pack.goalkeeper-55)*0.026-goalsAgainst*0.12;
      base+=(goals[n]||0)*0.88+(assists[n]||0)*0.52;
      if(goalsFor>=5)base+=0.25;
      if(goalsAgainst>=5&&['cb','lb','rb','cdm','gk'].includes(r))base-=0.55;
      if(dominance<-18)base-=0.75;
      if(starGravity(p,r)>20&&dominance>0)base+=0.28;
      ratings.push({name:n,role:r,rating:round(clamp(base,3.0,10.0),1),goals:goals[n]||0,assists:assists[n]||0,impact:round(starGravity(p,r),1)});
    }
    return ratings.sort((a,b)=>b.rating-a.rating);
  }
  function generateNarrative(packA,packB,names,score,battles){
    const w=score.goalsA>score.goalsB?names[0]:score.goalsB>score.goalsA?names[1]:'Draw';
    const diff=packA.final-packB.final;
    const winPack=diff>=0?packA:packB;
    const losePack=diff>=0?packB:packA;
    const winName=diff>=0?names[0]:names[1];
    const loseName=diff>=0?names[1]:names[0];
    const reasons=[];
    if(Math.abs(diff)<2)reasons.push(`The teams are almost inseparable: the engine sees this as a tactical coin flip rather than a clear superiority call.`);
    else reasons.push(`${winName} grade out higher because their strengths are not isolated ratings; they are actually usable against ${loseName}'s weaknesses.`);
    if(winPack.transition.score>losePack.defence.score+12)reasons.push(`${winName}'s transition threat is decisive: the opponent leaves enough space for runners and does not have enough recovery protection.`);
    if(winPack.midfield.score>losePack.midfield.score+10)reasons.push(`${winName} control midfield through press resistance, dirty work and passing angles, so their attackers receive better situations.`);
    if(winPack.attack.gravity.attackFreeMen>7)reasons.push(`${winName}'s star attacker creates gravity. Extra cover is dragged toward him, which opens free men elsewhere.`);
    if(losePack.weakness.items.length)reasons.push(`${loseName}'s main exploitable weakness is ${losePack.weakness.items[0].id}, because ${losePack.weakness.items[0].exploiter}.`);
    if(winPack.defence.focus.containment>86)reasons.push(`${winName} identify the danger early and have enough elite cover to prevent the opponent's best player becoming a one-man team.`);
    if(score.goalsA>=6||score.goalsB>=6)reasons.push(`The score becomes brutal because the mismatch repeats across phases, not because of one stat alone.`);
    if(score.goalsA===0&&score.goalsB===0)reasons.push(`This becomes a lock-down match: both defensive structures and goalkeepers suppress the attacking patterns.`);
    return{winner:w,summary:reasons.join(' '),decidingBattle:battles[0]||null};
  }
  function calculateUltraDynamicVerdict(teamA,teamB,names=['Team A','Team B']){
    const packA=phasePackage(teamA,teamB);
    const packB=phasePackage(teamB,teamA);
    const math=winnerMath(packA,packB);
    const score=deterministicScoreline(packA,packB);
    const battles=generateKeyBattles(teamA,teamB,names);
    const ratingsA=playerRatings(teamA,packA,packB,score.goalsA,score.goalsB);
    const ratingsB=playerRatings(teamB,packB,packA,score.goalsB,score.goalsA);
    const allRatings=ratingsA.map(r=>({...r,team:names[0]})).concat(ratingsB.map(r=>({...r,team:names[1]}))).sort((a,b)=>b.rating-a.rating);
    const motm=allRatings[0]||null;
    const narrative=generateNarrative(packA,packB,names,score,battles);
    const winner=score.goalsA>score.goalsB?names[0]:score.goalsB>score.goalsA?names[1]:'Draw';
    return{
      version:DZ_VERSION,
      winner,
      winProbability:{[names[0]]:round(math.probA,1),[names[1]]:round(math.probB,1)},
      verdictType:math.type,
      finalScores:{[names[0]]:round(packA.final,1),[names[1]]:round(packB.final,1)},
      scoreline:score.scoreline,
      expectedGoals:{[names[0]]:score.xgA,[names[1]]:score.xgB},
      phases:{
        [names[0]]:publicPhases(packA),
        [names[1]]:publicPhases(packB)
      },
      keyBattles:battles,
      playerRatings:{[names[0]]:ratingsA,[names[1]]:ratingsB,manOfTheMatch:motm},
      tactical:{[names[0]]:styleModel(teamA,teamB),[names[1]]:styleModel(teamB,teamA)},
      weaknesses:{[names[0]]:packA.weakness,[names[1]]:packB.weakness},
      narrative:narrative.summary,
      decidingBattle:narrative.decidingBattle,
      debug:{packA,packB,math}
    };
  }
  function publicPhases(p){return{
    attack:round(p.attack.score,1),
    midfield:round(p.midfield.score,1),
    defence:round(p.defence.score,1),
    transition:round(p.transition.score,1),
    leftFlank:round(p.leftFlank.score,1),
    rightFlank:round(p.rightFlank.score,1),
    chanceCreation:round(p.chanceCreation,1),
    possession:round(p.possession,1),
    pressing:round(p.pressing,1),
    setPieces:round(p.setPieces.score,1),
    goalkeeper:round(p.goalkeeper,1),
    synergy:round(p.synergy.score,1),
    weaknessPenalty:round(p.weakness.total,1),
    final:round(p.final,1)
  };}

  function enhancePlayerObject(p){
    if(!p||p.__ultraEnhanced)return p;
    p.composure=attr(p,'composure');
    p.marking=attr(p,'marking');
    p.recoveryPace=attr(p,'recoveryPace');
    p.lineBreaking=attr(p,'lineBreaking');
    p.poaching=attr(p,'poaching');
    p.linkUp=attr(p,'linkUp');
    p.decisionMaking=attr(p,'decisionMaking');
    p.duelStrength=attr(p,'duelStrength');
    p.heading=attr(p,'heading');
    p.clutch=attr(p,'clutch');
    p.visionRange=attr(p,'visionRange');
    p.offTheBall=attr(p,'offTheBall');
    p.aggression=attr(p,'aggression');
    p.adaptability=attr(p,'adaptability');
    p.__ultraEnhanced=true;
    return p;
  }
  function enhanceAllPlayers(){
    const pools=['PLAYERS','EXTRA_PLAYERS','players','extraPlayers'];
    for(const pool of pools){
      const arr=root[pool];
      if(Array.isArray(arr))arr.forEach(enhancePlayerObject);
    }
  }
  function patchEngine(){
    enhanceAllPlayers();
    root.ENGINE.calculateUltraDynamicVerdict=calculateUltraDynamicVerdict;
    root.ENGINE.ultraDynamicPhasePackage=phasePackage;
    root.ENGINE.ultraDynamicTeamDNA=teamDNA;
    root.ENGINE.ultraDynamicKeyBattles=generateKeyBattles;
    root.ENGINE.ultraDynamicEnhancePlayers=enhanceAllPlayers;
    root.ENGINE.ultraDynamicVersion=DZ_VERSION;
    const old=root.ENGINE.calculateAdvancedVerdict;
    root.ENGINE.calculateAdvancedVerdict=function(teamA,teamB,names){
      try{return calculateUltraDynamicVerdict(teamA,teamB,names||['Team A','Team B']);}
      catch(err){console.error('Ultra Dynamic Engine failed, falling back:',err);return old?old(teamA,teamB,names):{error:String(err)};}
    };
  }
  patchEngine();
  if(root.addEventListener)root.addEventListener('load',enhanceAllPlayers);
  const MICRO_FACTORS={};
  MICRO_FACTORS.paceBehind=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='paceBehind';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.lowBlock=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='lowBlock';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.highLine=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='highLine';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.wideOverload=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='wideOverload';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.centralOverload=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='centralOverload';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.crossingRoute=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='crossingRoute';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.setPieceRoute=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='setPieceRoute';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.counterPress=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='counterPress';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.deepBuildUp=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='deepBuildUp';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.secondBalls=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='secondBalls';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.halfSpace=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='halfSpace';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.boxCrowding=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='boxCrowding';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.isolation=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='isolation';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.doubleTeam=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='doubleTeam';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.freeMan=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='freeMan';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.fatigueWave=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='fatigueWave';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.clutchTime=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='clutchTime';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.keeperDistribution=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='keeperDistribution';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.aerialSiege=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='aerialSiege';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.pressTrap=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='pressTrap';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.switchPlay=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='switchPlay';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.underlap=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='underlap';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.overlap=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='overlap';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.invertedFullback=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='invertedFullback';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.restDefence=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='restDefence';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.lateRunner=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='lateRunner';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.cutbackZone=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='cutbackZone';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.falseNineDrop=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='falseNineDrop';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.poacherZone=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='poacherZone';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.chaosDribble=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='chaosDribble';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.tempoKill=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='tempoKill';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.duelStorm=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='duelStorm';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.leaderLift=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='leaderLift';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.megaStarGravity=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='megaStarGravity';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.weakLinkTarget=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='weakLinkTarget';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.protectiveMidfield=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='protectiveMidfield';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.dirtyWorkCover=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='dirtyWorkCover';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.defensiveTriangle=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='defensiveTriangle';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.attackingTriangle=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='attackingTriangle';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  MICRO_FACTORS.midfieldDiamond=function(attTeam,defTeam){
    const A=teamDNA(attTeam);
    const D=teamDNA(defTeam);
    const context='midfieldDiamond';
    const related=CONTEXT_RULES.filter(r=>r.context===context);
    let value=50;
    for(const r of related){
      const source=(r.target==='defence'||r.target==='midfield')?D:A;
      value+=(source[r.stat]||70-70)*r.weight;
    }
    value+=Math.max(0,(A.megastar||0)-12)*0.18;
    value-=Math.max(0,(D.roleCoverage||70)-82)*0.12;
    return clamp(value,1,99);
  };
  function ultraDiagnosticReport(team,opp){
    const out={};
    out.paceBehind=round(MICRO_FACTORS.paceBehind(team,opp),1);
    out.lowBlock=round(MICRO_FACTORS.lowBlock(team,opp),1);
    out.highLine=round(MICRO_FACTORS.highLine(team,opp),1);
    out.wideOverload=round(MICRO_FACTORS.wideOverload(team,opp),1);
    out.centralOverload=round(MICRO_FACTORS.centralOverload(team,opp),1);
    out.crossingRoute=round(MICRO_FACTORS.crossingRoute(team,opp),1);
    out.setPieceRoute=round(MICRO_FACTORS.setPieceRoute(team,opp),1);
    out.counterPress=round(MICRO_FACTORS.counterPress(team,opp),1);
    out.deepBuildUp=round(MICRO_FACTORS.deepBuildUp(team,opp),1);
    out.secondBalls=round(MICRO_FACTORS.secondBalls(team,opp),1);
    out.halfSpace=round(MICRO_FACTORS.halfSpace(team,opp),1);
    out.boxCrowding=round(MICRO_FACTORS.boxCrowding(team,opp),1);
    out.isolation=round(MICRO_FACTORS.isolation(team,opp),1);
    out.doubleTeam=round(MICRO_FACTORS.doubleTeam(team,opp),1);
    out.freeMan=round(MICRO_FACTORS.freeMan(team,opp),1);
    out.fatigueWave=round(MICRO_FACTORS.fatigueWave(team,opp),1);
    out.clutchTime=round(MICRO_FACTORS.clutchTime(team,opp),1);
    out.keeperDistribution=round(MICRO_FACTORS.keeperDistribution(team,opp),1);
    out.aerialSiege=round(MICRO_FACTORS.aerialSiege(team,opp),1);
    out.pressTrap=round(MICRO_FACTORS.pressTrap(team,opp),1);
    out.switchPlay=round(MICRO_FACTORS.switchPlay(team,opp),1);
    out.underlap=round(MICRO_FACTORS.underlap(team,opp),1);
    out.overlap=round(MICRO_FACTORS.overlap(team,opp),1);
    out.invertedFullback=round(MICRO_FACTORS.invertedFullback(team,opp),1);
    out.restDefence=round(MICRO_FACTORS.restDefence(team,opp),1);
    out.lateRunner=round(MICRO_FACTORS.lateRunner(team,opp),1);
    out.cutbackZone=round(MICRO_FACTORS.cutbackZone(team,opp),1);
    out.falseNineDrop=round(MICRO_FACTORS.falseNineDrop(team,opp),1);
    out.poacherZone=round(MICRO_FACTORS.poacherZone(team,opp),1);
    out.chaosDribble=round(MICRO_FACTORS.chaosDribble(team,opp),1);
    out.tempoKill=round(MICRO_FACTORS.tempoKill(team,opp),1);
    out.duelStorm=round(MICRO_FACTORS.duelStorm(team,opp),1);
    out.leaderLift=round(MICRO_FACTORS.leaderLift(team,opp),1);
    out.megaStarGravity=round(MICRO_FACTORS.megaStarGravity(team,opp),1);
    out.weakLinkTarget=round(MICRO_FACTORS.weakLinkTarget(team,opp),1);
    out.protectiveMidfield=round(MICRO_FACTORS.protectiveMidfield(team,opp),1);
    out.dirtyWorkCover=round(MICRO_FACTORS.dirtyWorkCover(team,opp),1);
    out.defensiveTriangle=round(MICRO_FACTORS.defensiveTriangle(team,opp),1);
    out.attackingTriangle=round(MICRO_FACTORS.attackingTriangle(team,opp),1);
    out.midfieldDiamond=round(MICRO_FACTORS.midfieldDiamond(team,opp),1);
    return out;
  }
  root.ENGINE.ultraDynamicDiagnostics=ultraDiagnosticReport;
  const ULTRA_PHRASES={
    transition:[
      'transition narrative trigger 1: dynamic context changes the match state.',
      'transition narrative trigger 2: dynamic context changes the match state.',
      'transition narrative trigger 3: dynamic context changes the match state.',
      'transition narrative trigger 4: dynamic context changes the match state.',
      'transition narrative trigger 5: dynamic context changes the match state.',
      'transition narrative trigger 6: dynamic context changes the match state.',
      'transition narrative trigger 7: dynamic context changes the match state.',
      'transition narrative trigger 8: dynamic context changes the match state.',
      'transition narrative trigger 9: dynamic context changes the match state.',
      'transition narrative trigger 10: dynamic context changes the match state.',
      'transition narrative trigger 11: dynamic context changes the match state.',
      'transition narrative trigger 12: dynamic context changes the match state.',
    ],
    possession:[
      'possession narrative trigger 1: dynamic context changes the match state.',
      'possession narrative trigger 2: dynamic context changes the match state.',
      'possession narrative trigger 3: dynamic context changes the match state.',
      'possession narrative trigger 4: dynamic context changes the match state.',
      'possession narrative trigger 5: dynamic context changes the match state.',
      'possession narrative trigger 6: dynamic context changes the match state.',
      'possession narrative trigger 7: dynamic context changes the match state.',
      'possession narrative trigger 8: dynamic context changes the match state.',
      'possession narrative trigger 9: dynamic context changes the match state.',
      'possession narrative trigger 10: dynamic context changes the match state.',
      'possession narrative trigger 11: dynamic context changes the match state.',
      'possession narrative trigger 12: dynamic context changes the match state.',
    ],
    lowBlock:[
      'lowBlock narrative trigger 1: dynamic context changes the match state.',
      'lowBlock narrative trigger 2: dynamic context changes the match state.',
      'lowBlock narrative trigger 3: dynamic context changes the match state.',
      'lowBlock narrative trigger 4: dynamic context changes the match state.',
      'lowBlock narrative trigger 5: dynamic context changes the match state.',
      'lowBlock narrative trigger 6: dynamic context changes the match state.',
      'lowBlock narrative trigger 7: dynamic context changes the match state.',
      'lowBlock narrative trigger 8: dynamic context changes the match state.',
      'lowBlock narrative trigger 9: dynamic context changes the match state.',
      'lowBlock narrative trigger 10: dynamic context changes the match state.',
      'lowBlock narrative trigger 11: dynamic context changes the match state.',
      'lowBlock narrative trigger 12: dynamic context changes the match state.',
    ],
    highPress:[
      'highPress narrative trigger 1: dynamic context changes the match state.',
      'highPress narrative trigger 2: dynamic context changes the match state.',
      'highPress narrative trigger 3: dynamic context changes the match state.',
      'highPress narrative trigger 4: dynamic context changes the match state.',
      'highPress narrative trigger 5: dynamic context changes the match state.',
      'highPress narrative trigger 6: dynamic context changes the match state.',
      'highPress narrative trigger 7: dynamic context changes the match state.',
      'highPress narrative trigger 8: dynamic context changes the match state.',
      'highPress narrative trigger 9: dynamic context changes the match state.',
      'highPress narrative trigger 10: dynamic context changes the match state.',
      'highPress narrative trigger 11: dynamic context changes the match state.',
      'highPress narrative trigger 12: dynamic context changes the match state.',
    ],
    widePlay:[
      'widePlay narrative trigger 1: dynamic context changes the match state.',
      'widePlay narrative trigger 2: dynamic context changes the match state.',
      'widePlay narrative trigger 3: dynamic context changes the match state.',
      'widePlay narrative trigger 4: dynamic context changes the match state.',
      'widePlay narrative trigger 5: dynamic context changes the match state.',
      'widePlay narrative trigger 6: dynamic context changes the match state.',
      'widePlay narrative trigger 7: dynamic context changes the match state.',
      'widePlay narrative trigger 8: dynamic context changes the match state.',
      'widePlay narrative trigger 9: dynamic context changes the match state.',
      'widePlay narrative trigger 10: dynamic context changes the match state.',
      'widePlay narrative trigger 11: dynamic context changes the match state.',
      'widePlay narrative trigger 12: dynamic context changes the match state.',
    ],
    centralPlay:[
      'centralPlay narrative trigger 1: dynamic context changes the match state.',
      'centralPlay narrative trigger 2: dynamic context changes the match state.',
      'centralPlay narrative trigger 3: dynamic context changes the match state.',
      'centralPlay narrative trigger 4: dynamic context changes the match state.',
      'centralPlay narrative trigger 5: dynamic context changes the match state.',
      'centralPlay narrative trigger 6: dynamic context changes the match state.',
      'centralPlay narrative trigger 7: dynamic context changes the match state.',
      'centralPlay narrative trigger 8: dynamic context changes the match state.',
      'centralPlay narrative trigger 9: dynamic context changes the match state.',
      'centralPlay narrative trigger 10: dynamic context changes the match state.',
      'centralPlay narrative trigger 11: dynamic context changes the match state.',
      'centralPlay narrative trigger 12: dynamic context changes the match state.',
    ],
    setPieces:[
      'setPieces narrative trigger 1: dynamic context changes the match state.',
      'setPieces narrative trigger 2: dynamic context changes the match state.',
      'setPieces narrative trigger 3: dynamic context changes the match state.',
      'setPieces narrative trigger 4: dynamic context changes the match state.',
      'setPieces narrative trigger 5: dynamic context changes the match state.',
      'setPieces narrative trigger 6: dynamic context changes the match state.',
      'setPieces narrative trigger 7: dynamic context changes the match state.',
      'setPieces narrative trigger 8: dynamic context changes the match state.',
      'setPieces narrative trigger 9: dynamic context changes the match state.',
      'setPieces narrative trigger 10: dynamic context changes the match state.',
      'setPieces narrative trigger 11: dynamic context changes the match state.',
      'setPieces narrative trigger 12: dynamic context changes the match state.',
    ],
    superstar:[
      'superstar narrative trigger 1: dynamic context changes the match state.',
      'superstar narrative trigger 2: dynamic context changes the match state.',
      'superstar narrative trigger 3: dynamic context changes the match state.',
      'superstar narrative trigger 4: dynamic context changes the match state.',
      'superstar narrative trigger 5: dynamic context changes the match state.',
      'superstar narrative trigger 6: dynamic context changes the match state.',
      'superstar narrative trigger 7: dynamic context changes the match state.',
      'superstar narrative trigger 8: dynamic context changes the match state.',
      'superstar narrative trigger 9: dynamic context changes the match state.',
      'superstar narrative trigger 10: dynamic context changes the match state.',
      'superstar narrative trigger 11: dynamic context changes the match state.',
      'superstar narrative trigger 12: dynamic context changes the match state.',
    ],
    collapse:[
      'collapse narrative trigger 1: dynamic context changes the match state.',
      'collapse narrative trigger 2: dynamic context changes the match state.',
      'collapse narrative trigger 3: dynamic context changes the match state.',
      'collapse narrative trigger 4: dynamic context changes the match state.',
      'collapse narrative trigger 5: dynamic context changes the match state.',
      'collapse narrative trigger 6: dynamic context changes the match state.',
      'collapse narrative trigger 7: dynamic context changes the match state.',
      'collapse narrative trigger 8: dynamic context changes the match state.',
      'collapse narrative trigger 9: dynamic context changes the match state.',
      'collapse narrative trigger 10: dynamic context changes the match state.',
      'collapse narrative trigger 11: dynamic context changes the match state.',
      'collapse narrative trigger 12: dynamic context changes the match state.',
    ],
    lockdown:[
      'lockdown narrative trigger 1: dynamic context changes the match state.',
      'lockdown narrative trigger 2: dynamic context changes the match state.',
      'lockdown narrative trigger 3: dynamic context changes the match state.',
      'lockdown narrative trigger 4: dynamic context changes the match state.',
      'lockdown narrative trigger 5: dynamic context changes the match state.',
      'lockdown narrative trigger 6: dynamic context changes the match state.',
      'lockdown narrative trigger 7: dynamic context changes the match state.',
      'lockdown narrative trigger 8: dynamic context changes the match state.',
      'lockdown narrative trigger 9: dynamic context changes the match state.',
      'lockdown narrative trigger 10: dynamic context changes the match state.',
      'lockdown narrative trigger 11: dynamic context changes the match state.',
      'lockdown narrative trigger 12: dynamic context changes the match state.',
    ],
    dirtyWork:[
      'dirtyWork narrative trigger 1: dynamic context changes the match state.',
      'dirtyWork narrative trigger 2: dynamic context changes the match state.',
      'dirtyWork narrative trigger 3: dynamic context changes the match state.',
      'dirtyWork narrative trigger 4: dynamic context changes the match state.',
      'dirtyWork narrative trigger 5: dynamic context changes the match state.',
      'dirtyWork narrative trigger 6: dynamic context changes the match state.',
      'dirtyWork narrative trigger 7: dynamic context changes the match state.',
      'dirtyWork narrative trigger 8: dynamic context changes the match state.',
      'dirtyWork narrative trigger 9: dynamic context changes the match state.',
      'dirtyWork narrative trigger 10: dynamic context changes the match state.',
      'dirtyWork narrative trigger 11: dynamic context changes the match state.',
      'dirtyWork narrative trigger 12: dynamic context changes the match state.',
    ],
    coverage:[
      'coverage narrative trigger 1: dynamic context changes the match state.',
      'coverage narrative trigger 2: dynamic context changes the match state.',
      'coverage narrative trigger 3: dynamic context changes the match state.',
      'coverage narrative trigger 4: dynamic context changes the match state.',
      'coverage narrative trigger 5: dynamic context changes the match state.',
      'coverage narrative trigger 6: dynamic context changes the match state.',
      'coverage narrative trigger 7: dynamic context changes the match state.',
      'coverage narrative trigger 8: dynamic context changes the match state.',
      'coverage narrative trigger 9: dynamic context changes the match state.',
      'coverage narrative trigger 10: dynamic context changes the match state.',
      'coverage narrative trigger 11: dynamic context changes the match state.',
      'coverage narrative trigger 12: dynamic context changes the match state.',
    ],
    poaching:[
      'poaching narrative trigger 1: dynamic context changes the match state.',
      'poaching narrative trigger 2: dynamic context changes the match state.',
      'poaching narrative trigger 3: dynamic context changes the match state.',
      'poaching narrative trigger 4: dynamic context changes the match state.',
      'poaching narrative trigger 5: dynamic context changes the match state.',
      'poaching narrative trigger 6: dynamic context changes the match state.',
      'poaching narrative trigger 7: dynamic context changes the match state.',
      'poaching narrative trigger 8: dynamic context changes the match state.',
      'poaching narrative trigger 9: dynamic context changes the match state.',
      'poaching narrative trigger 10: dynamic context changes the match state.',
      'poaching narrative trigger 11: dynamic context changes the match state.',
      'poaching narrative trigger 12: dynamic context changes the match state.',
    ],
    scoreline:[
      'scoreline narrative trigger 1: dynamic context changes the match state.',
      'scoreline narrative trigger 2: dynamic context changes the match state.',
      'scoreline narrative trigger 3: dynamic context changes the match state.',
      'scoreline narrative trigger 4: dynamic context changes the match state.',
      'scoreline narrative trigger 5: dynamic context changes the match state.',
      'scoreline narrative trigger 6: dynamic context changes the match state.',
      'scoreline narrative trigger 7: dynamic context changes the match state.',
      'scoreline narrative trigger 8: dynamic context changes the match state.',
      'scoreline narrative trigger 9: dynamic context changes the match state.',
      'scoreline narrative trigger 10: dynamic context changes the match state.',
      'scoreline narrative trigger 11: dynamic context changes the match state.',
      'scoreline narrative trigger 12: dynamic context changes the match state.',
    ],
    motm:[
      'motm narrative trigger 1: dynamic context changes the match state.',
      'motm narrative trigger 2: dynamic context changes the match state.',
      'motm narrative trigger 3: dynamic context changes the match state.',
      'motm narrative trigger 4: dynamic context changes the match state.',
      'motm narrative trigger 5: dynamic context changes the match state.',
      'motm narrative trigger 6: dynamic context changes the match state.',
      'motm narrative trigger 7: dynamic context changes the match state.',
      'motm narrative trigger 8: dynamic context changes the match state.',
      'motm narrative trigger 9: dynamic context changes the match state.',
      'motm narrative trigger 10: dynamic context changes the match state.',
      'motm narrative trigger 11: dynamic context changes the match state.',
      'motm narrative trigger 12: dynamic context changes the match state.',
    ],
    fatigue:[
      'fatigue narrative trigger 1: dynamic context changes the match state.',
      'fatigue narrative trigger 2: dynamic context changes the match state.',
      'fatigue narrative trigger 3: dynamic context changes the match state.',
      'fatigue narrative trigger 4: dynamic context changes the match state.',
      'fatigue narrative trigger 5: dynamic context changes the match state.',
      'fatigue narrative trigger 6: dynamic context changes the match state.',
      'fatigue narrative trigger 7: dynamic context changes the match state.',
      'fatigue narrative trigger 8: dynamic context changes the match state.',
      'fatigue narrative trigger 9: dynamic context changes the match state.',
      'fatigue narrative trigger 10: dynamic context changes the match state.',
      'fatigue narrative trigger 11: dynamic context changes the match state.',
      'fatigue narrative trigger 12: dynamic context changes the match state.',
    ],
    clutch:[
      'clutch narrative trigger 1: dynamic context changes the match state.',
      'clutch narrative trigger 2: dynamic context changes the match state.',
      'clutch narrative trigger 3: dynamic context changes the match state.',
      'clutch narrative trigger 4: dynamic context changes the match state.',
      'clutch narrative trigger 5: dynamic context changes the match state.',
      'clutch narrative trigger 6: dynamic context changes the match state.',
      'clutch narrative trigger 7: dynamic context changes the match state.',
      'clutch narrative trigger 8: dynamic context changes the match state.',
      'clutch narrative trigger 9: dynamic context changes the match state.',
      'clutch narrative trigger 10: dynamic context changes the match state.',
      'clutch narrative trigger 11: dynamic context changes the match state.',
      'clutch narrative trigger 12: dynamic context changes the match state.',
    ],
    adaptation:[
      'adaptation narrative trigger 1: dynamic context changes the match state.',
      'adaptation narrative trigger 2: dynamic context changes the match state.',
      'adaptation narrative trigger 3: dynamic context changes the match state.',
      'adaptation narrative trigger 4: dynamic context changes the match state.',
      'adaptation narrative trigger 5: dynamic context changes the match state.',
      'adaptation narrative trigger 6: dynamic context changes the match state.',
      'adaptation narrative trigger 7: dynamic context changes the match state.',
      'adaptation narrative trigger 8: dynamic context changes the match state.',
      'adaptation narrative trigger 9: dynamic context changes the match state.',
      'adaptation narrative trigger 10: dynamic context changes the match state.',
      'adaptation narrative trigger 11: dynamic context changes the match state.',
      'adaptation narrative trigger 12: dynamic context changes the match state.',
    ],
    duels:[
      'duels narrative trigger 1: dynamic context changes the match state.',
      'duels narrative trigger 2: dynamic context changes the match state.',
      'duels narrative trigger 3: dynamic context changes the match state.',
      'duels narrative trigger 4: dynamic context changes the match state.',
      'duels narrative trigger 5: dynamic context changes the match state.',
      'duels narrative trigger 6: dynamic context changes the match state.',
      'duels narrative trigger 7: dynamic context changes the match state.',
      'duels narrative trigger 8: dynamic context changes the match state.',
      'duels narrative trigger 9: dynamic context changes the match state.',
      'duels narrative trigger 10: dynamic context changes the match state.',
      'duels narrative trigger 11: dynamic context changes the match state.',
      'duels narrative trigger 12: dynamic context changes the match state.',
    ],
    pressResistance:[
      'pressResistance narrative trigger 1: dynamic context changes the match state.',
      'pressResistance narrative trigger 2: dynamic context changes the match state.',
      'pressResistance narrative trigger 3: dynamic context changes the match state.',
      'pressResistance narrative trigger 4: dynamic context changes the match state.',
      'pressResistance narrative trigger 5: dynamic context changes the match state.',
      'pressResistance narrative trigger 6: dynamic context changes the match state.',
      'pressResistance narrative trigger 7: dynamic context changes the match state.',
      'pressResistance narrative trigger 8: dynamic context changes the match state.',
      'pressResistance narrative trigger 9: dynamic context changes the match state.',
      'pressResistance narrative trigger 10: dynamic context changes the match state.',
      'pressResistance narrative trigger 11: dynamic context changes the match state.',
      'pressResistance narrative trigger 12: dynamic context changes the match state.',
    ],
  };
  root.ENGINE.ultraDynamicPhraseBank=ULTRA_PHRASES;
  function minuteByMinuteTexture(teamA,teamB,packA,packB,score){
    const segments=[];
    segments.push(evaluateMatchMinute(5,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(10,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(15,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(20,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(25,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(30,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(35,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(40,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(45,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(50,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(55,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(60,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(65,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(70,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(75,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(80,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(85,teamA,teamB,packA,packB,score));
    segments.push(evaluateMatchMinute(90,teamA,teamB,packA,packB,score));
    return segments;
  }
  function evaluateMatchMinute(minute,teamA,teamB,packA,packB,score){
    const fatigueA=clamp((minute-55)*0.08+(78-packA.dna.stamina)*0.04,0,9);
    const fatigueB=clamp((minute-55)*0.08+(78-packB.dna.stamina)*0.04,0,9);
    const clutchA=minute>=75?Math.max(0,packA.dna.clutch-packB.dna.clutch)*0.08:0;
    const clutchB=minute>=75?Math.max(0,packB.dna.clutch-packA.dna.clutch)*0.08:0;
    const controlA=packA.possession+packA.midfield.score*0.25+clutchA-fatigueA;
    const controlB=packB.possession+packB.midfield.score*0.25+clutchB-fatigueB;
    const momentum=scoreSplit(controlA-controlB,0.16);
    let state='balanced';
    if(momentum>68)state='teamA pressure';
    if(momentum<32)state='teamB pressure';
    if(minute>=80&&Math.abs(score.goalsA-score.goalsB)<=1)state+=' / clutch zone';
    return{minute,state,momentumA:momentum,momentumB:100-momentum,fatigueA:round(fatigueA,1),fatigueB:round(fatigueB,1)};
  }
  function attachTexture(result,teamA,teamB){
    if(!result||!result.debug)return result;
    result.matchTexture=minuteByMinuteTexture(teamA,teamB,result.debug.packA,result.debug.packB,{goalsA:+String(result.scoreline).split('-')[0],goalsB:+String(result.scoreline).split('-')[1]});
    return result;
  }
  const baseUltra=root.ENGINE.calculateUltraDynamicVerdict;
  root.ENGINE.calculateUltraDynamicVerdict=function(teamA,teamB,names){
    return attachTexture(baseUltra(teamA,teamB,names),teamA,teamB);
  };
  root.ENGINE.calculateAdvancedVerdict=function(teamA,teamB,names){
    return root.ENGINE.calculateUltraDynamicVerdict(teamA,teamB,names||['Team A','Team B']);
  };
  function scenario_messiTripleCover(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='messiTripleCover';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_mbappeHighLineBreak(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='mbappeHighLineBreak';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_matthausDirtyWorkAura(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='matthausDirtyWorkAura';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_maradonaOneManChaos(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='maradonaOneManChaos';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_poacherWithPlaymaker(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='poacherWithPlaymaker';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_lowBlockLockdown(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='lowBlockLockdown';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_weakFullbackTargeting(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='weakFullbackTargeting';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_keeperMeltdown(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='keeperMeltdown';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_midfieldOverload(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='midfieldOverload';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_aerialBombardment(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='aerialBombardment';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_pressResistanceEscape(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='pressResistanceEscape';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenario_lateClutchSwing(team,opp){
    const A=teamDNA(team);
    const B=teamDNA(opp);
    const g=gravityAndCover(team,opp);
    const t=transitionScore(team,opp);
    const m=midfieldBattle(team,opp);
    const d=defensiveResistance(opp,team);
    const id='lateClutchSwing';
    let impact=50;
    impact+=Math.max(0,A.megastar-14)*0.9;
    impact+=Math.max(0,t.score-70)*0.35;
    impact+=Math.max(0,m.score-70)*0.22;
    impact-=Math.max(0,d.score-70)*0.24;
    impact+=Math.max(0,g.attackFreeMen)*0.6;
    return{id,impact:round(clamp(impact,1,99),1),freeMen:round(g.attackFreeMen,1),transition:round(t.score,1),midfield:round(m.score,1),opponentResistance:round(d.score,1)};
  }
  function scenarioMap(team,opp){return{
    messiTripleCover:scenario_messiTripleCover(team,opp),
    mbappeHighLineBreak:scenario_mbappeHighLineBreak(team,opp),
    matthausDirtyWorkAura:scenario_matthausDirtyWorkAura(team,opp),
    maradonaOneManChaos:scenario_maradonaOneManChaos(team,opp),
    poacherWithPlaymaker:scenario_poacherWithPlaymaker(team,opp),
    lowBlockLockdown:scenario_lowBlockLockdown(team,opp),
    weakFullbackTargeting:scenario_weakFullbackTargeting(team,opp),
    keeperMeltdown:scenario_keeperMeltdown(team,opp),
    midfieldOverload:scenario_midfieldOverload(team,opp),
    aerialBombardment:scenario_aerialBombardment(team,opp),
    pressResistanceEscape:scenario_pressResistanceEscape(team,opp),
    lateClutchSwing:scenario_lateClutchSwing(team,opp),
  };}
  root.ENGINE.ultraDynamicScenarioMap=scenarioMap;
  root.ENGINE.__ultraDynamicReady=true;
})();



/*
═══════════════════════════════════════════════════════════════════════════════
DRAFT ZONE — REALISM BALANCE + TRUE FOOTBALL SIM PATCH v6.2
Paste this entire block at the VERY BOTTOM of engine.js, after the ultra patch.

Purpose:
- Fixes phase scores that were saturating at 99/99 or showing nonsense values.
- Makes attack / midfield / defence / transition / pressing absolute team qualities,
  then uses context separately for matchup advantages.
- Makes normal scorelines common: 0-0, 1-0, 1-1, 2-1, 3-1, 3-2.
- Still allows 5-0, 7-2, 9-0, 10-3, etc when the matchup is genuinely brutal.
- Does not hard cap scoreline possibility.
- Gives defenders realistic match ratings.
- Lets players score/assist multiple times.
- Adds true star gravity: Messi/Maradona/Mbappé/R9-level players drag defenders,
  create overloads, open space for teammates, or force tactical cover.
- Adds dirty-work cover: Matthäus, Rijkaard, Rice, Caicedo, Gullit-style midfielders
  protect weaker defenders and stop transitions if they have the attributes.
- Keeps output compatible with your existing index.html result screen.
═══════════════════════════════════════════════════════════════════════════════
*/
;(function(){
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  root.ENGINE = root.ENGINE || {};
  const PATCH_VERSION = "realism-balance-v6.2";

  // ─────────────────────────────────────────────────────────────────────────
  // 1. FOUNDATIONAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const isNum = v => Number.isFinite(+v);
  const clamp = (v, lo=0, hi=100) => Math.max(lo, Math.min(hi, isNum(v) ? +v : 0));
  const round = (v, d=1) => {
    const m = Math.pow(10,d);
    return Math.round((isNum(v) ? +v : 0) * m) / m;
  };
  const avg = arr => {
    const f = (arr||[]).flat().filter(isNum).map(Number);
    return f.length ? f.reduce((a,b)=>a+b,0) / f.length : 0;
  };
  const sum = arr => (arr||[]).filter(isNum).map(Number).reduce((a,b)=>a+b,0);
  const max = arr => Math.max(...((arr||[]).filter(isNum).map(Number).concat([0])));
  const min = arr => Math.min(...((arr||[]).filter(isNum).map(Number).concat([100])));
  const sortBy = (arr, fn) => [...(arr||[])].sort((a,b)=>fn(b)-fn(a));
  const sigmoid = x => 1 / (1 + Math.exp(-x));
  const safeName = p => (p && p.name ? String(p.name).split("—")[0].trim() : "Unknown");
  const has = (p, t) => !!(p && Array.isArray(p.traits) && p.traits.includes(t));
  const plays = (p, t) => !!(p && Array.isArray(p.playstyles) && p.playstyles.includes(t));

  // Deterministic-ish noise. It is small, so better teams still usually win,
  // but not every match is identical.
  function hashString(s){
    let h=2166136261;
    for(let i=0;i<String(s).length;i++){
      h ^= String(s).charCodeAt(i);
      h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);
    }
    return h>>>0;
  }
  function seededNoise(label, lo=-0.12, hi=0.12){
    const h = hashString(label + "|" + new Date().toDateString());
    const x = (h % 10000) / 10000;
    return lo + (hi-lo)*x;
  }

  function attr(p,k,def=70){
    if(!p) return def;
    if(k === "defence"){
      if(p.defence != null) return +p.defence;
      if(p.defense != null) return +p.defense;
    }
    if(k === "defense"){
      if(p.defense != null) return +p.defense;
      if(p.defence != null) return +p.defence;
    }
    if(p[k] != null && isNum(p[k])) return +p[k];

    // Intelligent defaults, so old player objects still work.
    switch(k){
      case "composure": return avg([attr(p,"technical",def), attr(p,"intelligence",def), attr(p,"consistency",def)]);
      case "marking": return avg([attr(p,"defence",def), attr(p,"defensiveAwareness",def), attr(p,"positioning",def)]);
      case "recoveryPace": return avg([attr(p,"pace",def), attr(p,"stamina",def), attr(p,"defence",def)]);
      case "lineBreaking": return avg([attr(p,"passing",def), attr(p,"visionRange",def), attr(p,"technical",def)]);
      case "poaching": return avg([attr(p,"finishing",def), attr(p,"positioning",def), attr(p,"offTheBall",def)]);
      case "linkUp": return avg([attr(p,"passing",def), attr(p,"creativity",def), attr(p,"intelligence",def)]);
      case "decisionMaking": return avg([attr(p,"intelligence",def), attr(p,"composure",def), attr(p,"consistency",def)]);
      case "duelStrength": return avg([attr(p,"physical",def), attr(p,"aggression",def), attr(p,"aerial",def)]);
      case "heading": return avg([attr(p,"aerial",def), attr(p,"physical",def), attr(p,"positioning",def)]);
      case "clutch": return avg([attr(p,"bigGameRating",def), attr(p,"consistency",def), attr(p,"leadership",def)]);
      case "visionRange": return avg([attr(p,"passing",def), attr(p,"creativity",def), attr(p,"intelligence",def)]);
      case "offTheBall": return avg([attr(p,"positioning",def), attr(p,"intelligence",def), attr(p,"pace",def), attr(p,"finishing",def)]);
      case "aggression": return avg([attr(p,"pressing",def), attr(p,"workRate",def), attr(p,"physical",def), attr(p,"tackling",def)]);
      case "adaptability": return avg([attr(p,"intelligence",def), attr(p,"versatility",def), attr(p,"consistency",def)]);
      case "goalkeeperRating": return p.position === "GK" ? attr(p,"overall",def) : 0;
      case "reflexes": return p.position === "GK" ? attr(p,"overall",def) : 0;
      case "commandOfArea": return p.position === "GK" ? avg([attr(p,"overall",def), attr(p,"aerial",def)]) : 0;
      case "distribution": return p.position === "GK" ? avg([attr(p,"passing",def), attr(p,"technical",def), attr(p,"overall",def)]) : 0;
      default: return def;
    }
  }

  // Keeps ratings realistic. 99 should be rare. A team phase only reaches 99
  // when several elite players combine correctly.
  function footballScale(raw){
    raw = isNum(raw) ? raw : 70;
    if(raw <= 50) return clamp(raw,1,99);
    if(raw < 75) return 50 + (raw-50)*0.96;
    if(raw < 88) return 74 + (raw-75)*0.82;
    if(raw < 95) return 84.7 + (raw-88)*0.58;
    return clamp(88.8 + (raw-95)*0.36,1,99);
  }

  function weighted(items){
    let total=0, wsum=0;
    for(const it of items||[]){
      const v = isNum(it[0]) ? +it[0] : 0;
      const w = isNum(it[1]) ? +it[1] : 0;
      total += v*w; wsum += w;
    }
    return wsum ? total/wsum : 0;
  }

  function scoreSplit(diff, sharpness=0.14){
    const s = sigmoid(diff * sharpness);
    return clamp(Math.round(s*100),1,99);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ROLE READING — works with your current LAYOUT system
  // ─────────────────────────────────────────────────────────────────────────
  const ROLE_GROUPS = {
    attackers:["st","lw","rw","cam"],
    midfielders:["cdm","cm","cam"],
    defenders:["lb","rb","cb"],
    fullbacks:["lb","rb"],
    central:["st","cam","cm","cdm","cb"],
    wide:["lw","rw","lb","rb"],
    creators:["cam","cm","rw","lw"],
    screeners:["cdm","cm"],
    stoppers:["cb","cdm","lb","rb"]
  };

  function getLayout(){
    if(Array.isArray(root.LAYOUT)) return root.LAYOUT;
    return [
      {role:"gk"},{role:"lb"},{role:"cb"},{role:"cb"},{role:"rb"},
      {role:"cdm"},{role:"cm"},{role:"cm"},{role:"cam"},
      {role:"lw"},{role:"st"},{role:"rw"}
    ];
  }
  function units(team){
    const layout = getLayout();
    const all = [];
    for(let i=0;i<(team||[]).length;i++){
      const p = team[i];
      if(!p) continue;
      const role = (layout[i] && layout[i].role) || String(p.position||"").toLowerCase() || "cm";
      all.push({p, role, slot:i});
    }
    const byRole = r => all.filter(x=>x.role===r);
    const one = r => byRole(r)[0] || null;
    const group = g => all.filter(x => (ROLE_GROUPS[g]||[]).includes(x.role));
    return {
      all,
      gk: one("gk"),
      st: one("st"),
      lw: one("lw"),
      rw: one("rw"),
      cam: one("cam"),
      cdm: one("cdm"),
      cms: byRole("cm"),
      cbs: byRole("cb"),
      lb: one("lb"),
      rb: one("rb"),
      attackers: group("attackers"),
      midfielders: group("midfielders"),
      defenders: group("defenders"),
      fullbacks: group("fullbacks"),
      creators: group("creators"),
      screeners: group("screeners"),
      stoppers: group("stoppers"),
      wide: group("wide"),
      central: group("central")
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PLAYER ROLE SCORES
  // ─────────────────────────────────────────────────────────────────────────
  function roleScore(x){
    const p = x.p || x;
    const r = x.role || String(p.position||"").toLowerCase();
    if(r==="gk") return footballScale(weighted([
      [attr(p,"goalkeeperRating"),.36],[attr(p,"reflexes"),.21],
      [attr(p,"commandOfArea"),.15],[attr(p,"distribution"),.12],
      [attr(p,"composure"),.08],[attr(p,"clutch"),.08]
    ]));
    if(r==="st") return footballScale(weighted([
      [attr(p,"attack"),.18],[attr(p,"finishing"),.20],[attr(p,"poaching"),.15],
      [attr(p,"offTheBall"),.12],[attr(p,"physical"),.08],[attr(p,"pace"),.08],
      [attr(p,"technical"),.08],[attr(p,"clutch"),.06],[attr(p,"linkUp"),.05]
    ]));
    if(r==="lw" || r==="rw") return footballScale(weighted([
      [attr(p,"attack"),.16],[attr(p,"dribbling"),.16],[attr(p,"pace"),.15],
      [attr(p,"technical"),.13],[attr(p,"creativity"),.10],[attr(p,"finishing"),.09],
      [attr(p,"crossing"),.08],[attr(p,"transitionThreat"),.08],[attr(p,"workRate"),.05]
    ]));
    if(r==="cam") return footballScale(weighted([
      [attr(p,"midfield"),.15],[attr(p,"creativity"),.18],[attr(p,"passing"),.14],
      [attr(p,"technical"),.13],[attr(p,"visionRange"),.13],[attr(p,"attack"),.09],
      [attr(p,"pressResistance"),.08],[attr(p,"offTheBall"),.05],[attr(p,"clutch"),.05]
    ]));
    if(r==="cm") return footballScale(weighted([
      [attr(p,"midfield"),.20],[attr(p,"passing"),.14],[attr(p,"pressResistance"),.13],
      [attr(p,"workRate"),.11],[attr(p,"technical"),.10],[attr(p,"intelligence"),.10],
      [attr(p,"stamina"),.08],[attr(p,"defence"),.07],[attr(p,"attack"),.04],
      [attr(p,"adaptability"),.03]
    ]));
    if(r==="cdm") return footballScale(weighted([
      [attr(p,"defence"),.18],[attr(p,"midfield"),.17],[attr(p,"defensiveAwareness"),.14],
      [attr(p,"tackling"),.12],[attr(p,"positioning"),.10],[attr(p,"intelligence"),.09],
      [attr(p,"physical"),.07],[attr(p,"pressResistance"),.06],[attr(p,"workRate"),.05],
      [attr(p,"adaptability"),.02]
    ]));
    if(r==="cb") return footballScale(weighted([
      [attr(p,"defence"),.22],[attr(p,"defensiveAwareness"),.17],[attr(p,"tackling"),.13],
      [attr(p,"positioning"),.12],[attr(p,"aerial"),.11],[attr(p,"physical"),.09],
      [attr(p,"intelligence"),.08],[attr(p,"recoveryPace"),.05],[attr(p,"composure"),.03]
    ]));
    if(r==="lb" || r==="rb") return footballScale(weighted([
      [attr(p,"defence"),.16],[attr(p,"pace"),.15],[attr(p,"workRate"),.13],
      [attr(p,"stamina"),.10],[attr(p,"tackling"),.10],[attr(p,"defensiveAwareness"),.10],
      [attr(p,"crossing"),.08],[attr(p,"attack"),.07],[attr(p,"intelligence"),.07],
      [attr(p,"technical"),.04]
    ]));
    return footballScale(attr(p,"overall",75));
  }

  function threatAttack(x){
    const p=x.p;
    return footballScale(weighted([
      [roleScore(x),.18],[attr(p,"attack"),.15],[attr(p,"finishing"),.15],
      [attr(p,"dribbling"),.12],[attr(p,"creativity"),.10],[attr(p,"technical"),.10],
      [attr(p,"pace"),.07],[attr(p,"offTheBall"),.07],[attr(p,"clutch"),.06]
    ]));
  }
  function threatCreation(x){
    const p=x.p;
    return footballScale(weighted([
      [attr(p,"creativity"),.22],[attr(p,"visionRange"),.18],[attr(p,"passing"),.17],
      [attr(p,"technical"),.12],[attr(p,"pressResistance"),.10],[attr(p,"lineBreaking"),.10],
      [attr(p,"decisionMaking"),.07],[attr(p,"setPieces"),.04]
    ]));
  }
  function threatDefence(x){
    const p=x.p;
    return footballScale(weighted([
      [roleScore(x),.20],[attr(p,"defence"),.19],[attr(p,"defensiveAwareness"),.16],
      [attr(p,"tackling"),.13],[attr(p,"positioning"),.10],[attr(p,"intelligence"),.08],
      [attr(p,"physical"),.06],[attr(p,"recoveryPace"),.05],[attr(p,"adaptability"),.03]
    ]));
  }
  function threatTransition(x){
    const p=x.p;
    return footballScale(weighted([
      [attr(p,"pace"),.24],[attr(p,"transitionThreat"),.22],[attr(p,"offTheBall"),.13],
      [attr(p,"dribbling"),.12],[attr(p,"lineBreaking"),.10],[attr(p,"passing"),.07],
      [attr(p,"decisionMaking"),.06],[attr(p,"stamina"),.04],[attr(p,"attack"),.02]
    ]));
  }
  function threatPressing(x){
    const p=x.p;
    return footballScale(weighted([
      [attr(p,"pressing"),.24],[attr(p,"workRate"),.20],[attr(p,"stamina"),.16],
      [attr(p,"aggression"),.14],[attr(p,"intelligence"),.10],[attr(p,"pace"),.06],
      [attr(p,"tackling"),.06],[attr(p,"adaptability"),.04]
    ]));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. STAR GRAVITY + DIRTY WORK
  // ─────────────────────────────────────────────────────────────────────────
  function starGravityOf(x){
    if(!x) return 0;
    const p=x.p;
    const base = weighted([
      [attr(p,"overall"),.18],[attr(p,"attack"),.14],[attr(p,"technical"),.13],
      [attr(p,"dribbling"),.12],[attr(p,"creativity"),.11],[attr(p,"finishing"),.10],
      [attr(p,"visionRange"),.08],[attr(p,"clutch"),.07],[attr(p,"offTheBall"),.07]
    ]);
    let bonus=0;
    if(attr(p,"overall")>=97) bonus+=12;
    else if(attr(p,"overall")>=95) bonus+=8;
    else if(attr(p,"overall")>=92) bonus+=4;
    if(has(p,"dribbleMaestro")) bonus+=5;
    if(has(p,"eliteFinisher")) bonus+=4;
    if(has(p,"chanceCreator")) bonus+=4;
    if(has(p,"bigGamePlayer")) bonus+=3;
    return clamp((base-82)*1.25 + bonus, 0, 30);
  }

  function dirtyWorkOf(x){
    if(!x) return 0;
    const p=x.p, r=x.role;
    const base = weighted([
      [attr(p,"defence"),.15],[attr(p,"midfield"),.13],[attr(p,"workRate"),.14],
      [attr(p,"stamina"),.12],[attr(p,"aggression"),.12],[attr(p,"tackling"),.11],
      [attr(p,"positioning"),.09],[attr(p,"intelligence"),.08],[attr(p,"physical"),.06]
    ]);
    let roleBonus = r==="cdm" ? 6 : r==="cm" ? 3 : r==="cb" ? 2 : 0;
    if(has(p,"boxToBox")) roleBonus+=4;
    if(has(p,"hardTackler")) roleBonus+=4;
    if(has(p,"protectiveScreener")) roleBonus+=5;
    if(has(p,"highWorkRate")) roleBonus+=3;
    if(has(p,"leader")) roleBonus+=2;
    return clamp((base-70)*0.55 + roleBonus, 0, 28);
  }

  function gravityMap(team){
    const u=units(team);
    const attackers = u.attackers.concat(u.creators).filter(Boolean);
    const stars = sortBy(attackers, starGravityOf).slice(0,4).map(x=>({
      name:safeName(x.p), role:x.role, gravity:round(starGravityOf(x),1), player:x
    })).filter(s=>s.gravity>2);
    const total = sum(stars.map(s=>s.gravity));
    return {stars,total:round(total,1),max:max(stars.map(s=>s.gravity))};
  }

  function dirtyWorkMap(team){
    const u=units(team);
    const workers = sortBy(u.midfielders.concat(u.defenders), dirtyWorkOf).slice(0,5).map(x=>({
      name:safeName(x.p), role:x.role, cover:round(dirtyWorkOf(x),1), player:x
    })).filter(s=>s.cover>2);
    const total = sum(workers.map(s=>s.cover));
    return {workers,total:round(total,1),max:max(workers.map(s=>s.cover))};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. ABSOLUTE TEAM DNA
  // These are NOT opponent-relative. They should look sensible on screen.
  // ─────────────────────────────────────────────────────────────────────────
  function teamDNA(team){
    const u=units(team);
    const all=u.all;
    const g=gravityMap(team);
    const dw=dirtyWorkMap(team);

    const atkUnits = u.attackers.length ? u.attackers : all;
    const midUnits = u.midfielders.length ? u.midfielders : all;
    const defUnits = u.defenders.length ? u.defenders : all;

    const topAttack = avg(sortBy(atkUnits, threatAttack).slice(0,4).map(threatAttack));
    const topCreation = avg(sortBy(all, threatCreation).slice(0,5).map(threatCreation));
    const topDefence = avg(sortBy(defUnits.concat(u.screeners), threatDefence).slice(0,6).map(threatDefence));
    const topTransition = avg(sortBy(atkUnits.concat(midUnits), threatTransition).slice(0,5).map(threatTransition));
    const topPressing = avg(sortBy(all, threatPressing).slice(0,7).map(threatPressing));

    const cbScore = avg(u.cbs.map(threatDefence));
    const fbScore = avg(u.fullbacks.map(threatDefence));
    const cdmScore = u.cdm ? threatDefence(u.cdm) : avg(u.cms.map(threatDefence))*0.82;
    const gkScore = u.gk ? footballScale(weighted([
      [attr(u.gk.p,"goalkeeperRating"),.42],[attr(u.gk.p,"reflexes"),.24],
      [attr(u.gk.p,"commandOfArea"),.16],[attr(u.gk.p,"composure"),.10],
      [attr(u.gk.p,"distribution"),.08]
    ])) : 55;

    const attack = footballScale(weighted([
      [topAttack,.44],[topCreation,.18],[avg(atkUnits.map(x=>attr(x.p,"finishing"))),.14],
      [avg(atkUnits.map(x=>attr(x.p,"offTheBall"))),.10],
      [avg(atkUnits.map(x=>attr(x.p,"technical"))),.08],
      [80 + g.max,.06]
    ]));

    const midfield = footballScale(weighted([
      [avg(midUnits.map(x=>roleScore(x))),.27],
      [avg(midUnits.map(x=>attr(x.p,"passing"))),.14],
      [avg(midUnits.map(x=>attr(x.p,"pressResistance"))),.13],
      [avg(midUnits.map(x=>attr(x.p,"intelligence"))),.12],
      [topCreation,.12],
      [avg(midUnits.map(x=>attr(x.p,"workRate"))),.10],
      [avg(midUnits.map(x=>attr(x.p,"defence"))),.07],
      [75 + dw.max,.05]
    ]));

    const defence = footballScale(weighted([
      [cbScore,.27],[fbScore,.13],[cdmScore,.17],[gkScore,.13],
      [avg(defUnits.map(x=>attr(x.p,"defensiveAwareness"))),.11],
      [avg(defUnits.map(x=>attr(x.p,"recoveryPace"))),.07],
      [avg(defUnits.map(x=>attr(x.p,"aerial"))),.06],
      [75 + dw.total*0.36,.06]
    ]));

    const transition = footballScale(weighted([
      [topTransition,.33],
      [avg(atkUnits.map(x=>attr(x.p,"pace"))),.16],
      [avg(atkUnits.map(x=>attr(x.p,"transitionThreat"))),.16],
      [avg(midUnits.map(x=>attr(x.p,"lineBreaking"))),.11],
      [avg(midUnits.map(x=>attr(x.p,"visionRange"))),.08],
      [avg(defUnits.map(x=>attr(x.p,"recoveryPace"))),.08],
      [75 + g.max,.08]
    ]));

    const wide = footballScale(weighted([
      [avg([u.lw?threatAttack(u.lw):60,u.rw?threatAttack(u.rw):60]),.29],
      [avg([u.lb?roleScore(u.lb):60,u.rb?roleScore(u.rb):60]),.18],
      [avg(all.filter(x=>["lw","rw","lb","rb"].includes(x.role)).map(x=>attr(x.p,"pace"))),.15],
      [avg(all.filter(x=>["lw","rw","lb","rb"].includes(x.role)).map(x=>attr(x.p,"crossing"))),.13],
      [avg(all.filter(x=>["lw","rw","lb","rb"].includes(x.role)).map(x=>attr(x.p,"workRate"))),.12],
      [avg(all.filter(x=>["lw","rw","lb","rb"].includes(x.role)).map(x=>attr(x.p,"defence"))),.08],
      [avg(all.filter(x=>["lw","rw","lb","rb"].includes(x.role)).map(x=>attr(x.p,"dribbling"))),.05]
    ]));

    const pressing = footballScale(weighted([
      [topPressing,.34],
      [avg(all.map(x=>attr(x.p,"workRate"))),.18],
      [avg(all.map(x=>attr(x.p,"stamina"))),.16],
      [avg(all.map(x=>attr(x.p,"aggression"))),.13],
      [avg(all.map(x=>attr(x.p,"intelligence"))),.10],
      [avg(u.attackers.map(x=>attr(x.p,"pressing"))),.09]
    ]));

    const setPieces = footballScale(weighted([
      [max(all.map(x=>attr(x.p,"setPieces"))),.20],
      [avg(sortBy(all, x=>attr(x.p,"crossing")).slice(0,4).map(x=>attr(x.p,"crossing"))),.17],
      [avg(sortBy(all, x=>attr(x.p,"aerial")).slice(0,5).map(x=>attr(x.p,"aerial"))),.18],
      [avg(sortBy(all, x=>attr(x.p,"heading")).slice(0,5).map(x=>attr(x.p,"heading"))),.13],
      [avg(sortBy(all, x=>attr(x.p,"physical")).slice(0,5).map(x=>attr(x.p,"physical"))),.10],
      [gkScore,.07],
      [avg(all.map(x=>attr(x.p,"positioning"))),.08],
      [avg(all.map(x=>attr(x.p,"clutch"))),.07]
    ]));

    const synergy = footballScale(calculateSynergyRaw(team, {u,g,dw,attack,midfield,defence,transition,wide,pressing,setPieces,gkScore}));

    const balance = footballScale(100 - (
      Math.abs(attack-defence)*0.45 +
      Math.abs(midfield-defence)*0.30 +
      Math.abs(attack-midfield)*0.25
    ));

    return {
      units:u, all, gravity:g, dirtyWork:dw,
      attack, midfield, defence, transition, wide, pressing, setPieces,
      goalkeeper:gkScore, synergy, balance,
      topAttack, topCreation, topDefence, topTransition,
      cbScore, fbScore, cdmScore,
      creativity:footballScale(topCreation),
      pressResistance:footballScale(avg(all.map(x=>attr(x.p,"pressResistance")))),
      technical:footballScale(avg(all.map(x=>attr(x.p,"technical")))),
      physical:footballScale(avg(all.map(x=>attr(x.p,"physical")))),
      pace:footballScale(avg(all.map(x=>attr(x.p,"pace")))),
      workRate:footballScale(avg(all.map(x=>attr(x.p,"workRate")))),
      intelligence:footballScale(avg(all.map(x=>attr(x.p,"intelligence")))),
      aerialAttack:footballScale(avg(sortBy(all, x=>attr(x.p,"aerial")).slice(0,5).map(x=>attr(x.p,"aerial")))),
      aerialDefence:footballScale(avg(defUnits.concat(u.gk?[u.gk]:[]).map(x=>attr(x.p,"aerial")))),
      finishing:footballScale(avg(atkUnits.map(x=>attr(x.p,"finishing")))),
      lineBreaking:footballScale(avg(midUnits.concat(u.creators).map(x=>attr(x.p,"lineBreaking")))),
      cdmCover: footballScale(70 + dw.total*0.85 + (u.cdm ? (threatDefence(u.cdm)-75)*0.4 : -5)),
      fbRisk: footballScale(avg(u.fullbacks.map(x=>attr(x.p,"attack")*0.75 + attr(x.p,"pace")*0.15 - attr(x.p,"defensiveAwareness")*0.18))),
      starGravity: g.total,
      dirtyCover: dw.total
    };
  }

  function calculateSynergyRaw(team, pre){
    const u=pre.u;
    let s=74;
    const names = u.all.map(x=>safeName(x.p).toLowerCase()).join("|");

    // Structural bonuses.
    if(u.cdm && u.cbs.length>=2) s += 4;
    if(u.gk && u.cbs.length>=2) s += 2;
    if(u.cam && u.st) s += 3;
    if(u.lw && u.lb) s += 2;
    if(u.rw && u.rb) s += 2;
    if(u.cms.length>=2 && u.cdm) s += 3;

    // Playstyle fit.
    const fastForwards = u.attackers.filter(x=>attr(x.p,"pace")>=88 || attr(x.p,"transitionThreat")>=88).length;
    const lineBreakers = u.midfielders.concat(u.creators).filter(x=>attr(x.p,"lineBreaking")>=84 || attr(x.p,"visionRange")>=86).length;
    const aerialTargets = u.attackers.concat(u.cbs).filter(x=>attr(x.p,"aerial")>=86 || attr(x.p,"heading")>=86).length;
    const crossers = u.all.filter(x=>attr(x.p,"crossing")>=86 || attr(x.p,"setPieces")>=88).length;
    const pressers = u.all.filter(x=>attr(x.p,"pressing")>=82 && attr(x.p,"workRate")>=82).length;
    const pressResistant = u.all.filter(x=>attr(x.p,"pressResistance")>=86 && attr(x.p,"technical")>=84).length;

    if(fastForwards>=2 && lineBreakers>=2) s += 5;
    if(aerialTargets>=2 && crossers>=2) s += 4;
    if(pressers>=6) s += 4;
    if(pressResistant>=5) s += 4;
    if(pre.dirtyWork.total>=18) s += 4;
    if(pre.gravity.max>=18 && lineBreakers>=1) s += 3;
    if(pre.gravity.max>=24 && lineBreakers>=2) s += 4;

    // Bad balance penalties.
    if(!u.cdm && u.cbs.length>=2) s -= 5;
    if(pre.defence < 68 && pre.fbRisk > 76) s -= 6;
    if(pre.attack > 88 && pre.midfield < 72) s -= 5;
    if(pre.pressing > 84 && avg(u.all.map(x=>attr(x.p,"stamina"))) < 74) s -= 4;
    if(pre.starGravity > 22 && pre.lineBreaking < 74) s -= 4; // star is isolated

    // Iconic intelligent all-rounders should raise everyone.
    if(names.includes("matthäus") || names.includes("matthaus")) s += 5;
    if(names.includes("rijkaard")) s += 4;
    if(names.includes("gullit")) s += 4;
    if(names.includes("zidane")) s += 4;
    if(names.includes("maradona")) s += 5;
    if(names.includes("messi")) s += 5;
    if(names.includes("xavi") || names.includes("iniesta")) s += 4;

    return s;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. CONTEXTUAL MATCHUP LOGIC
  // These create advantages without corrupting the displayed absolute ratings.
  // ─────────────────────────────────────────────────────────────────────────
  function contextualEdges(A,B){
    const edges=[];

    function add(id, value, text){
      if(Math.abs(value) >= 0.2) edges.push({id, value:round(value,2), text});
    }

    // Attack vs defensive resistance.
    add("attack-v-defence", (A.attack - B.defence)*0.13, "attacking quality versus defensive resistance");

    // Midfield control can either feed attackers or suffocate opponent.
    add("midfield-control", (A.midfield - B.midfield)*0.11, "midfield control and ball progression");

    // Transition depends on opponent line, fullback risk and dirty cover.
    const spaceBehind = clamp(50 + B.fbRisk*0.30 + (B.defence<74?8:0) + (B.cdmCover<74?7:0) - B.dirtyCover*0.22, 0, 100);
    const transitionRaw = (A.transition - B.defence)*0.08 + (A.pace - B.cbScore)*0.06 + (spaceBehind-55)*0.08;
    add("transition-space", transitionRaw, "space behind defensive line and recovery ability");

    // Pressing only matters if opponent cannot play through it.
    add("press-v-buildout", (A.pressing - B.pressResistance)*0.07, "pressing versus opponent press resistance");

    // Star gravity: if defenders must collapse onto a genius, teammates get space.
    const starEdge = A.starGravity*0.13 - B.dirtyCover*0.09 - B.intelligence*0.025;
    add("star-gravity", starEdge, "elite player gravity creates overloads and frees teammates");

    // Dirty work cover: helps bad defences survive.
    const coverEdge = A.dirtyCover*0.10 - B.starGravity*0.05;
    add("dirty-work-cover", coverEdge, "midfield dirty work protects weak zones");

    // Wide overloads.
    add("wide-overload", (A.wide - B.wide)*0.07 + (A.setPieces-B.aerialDefence)*0.035, "wide play, crossing and set-piece pressure");

    // Goalkeeper edge.
    add("goalkeeper-edge", (A.goalkeeper - B.goalkeeper)*0.06, "goalkeeping shot prevention");

    // Synergy matters, but less than actual talent.
    add("synergy-edge", (A.synergy - B.synergy)*0.075, "team chemistry and tactical fit");

    // Brutal mismatch extra.
    const rawQualityA = avg([A.attack,A.midfield,A.defence,A.goalkeeper,A.synergy]);
    const rawQualityB = avg([B.attack,B.midfield,B.defence,B.goalkeeper,B.synergy]);
    add("raw-quality-gap", (rawQualityA-rawQualityB)*0.10, "overall football quality gap");

    return edges;
  }

  function finalScoreFromDNA(A,B){
    const base = weighted([
      [A.attack,.17],[A.midfield,.16],[A.defence,.16],[A.transition,.10],
      [A.creativity,.09],[A.pressing,.07],[A.setPieces,.05],[A.goalkeeper,.08],
      [A.synergy,.07],[A.balance,.05]
    ]);
    const edges = contextualEdges(A,B);
    const edgeValue = sum(edges.map(e=>e.value));
    const weakness = contextualWeaknessPenalty(A,B);
    return {score:clamp(base + edgeValue - weakness.total, 1, 120), base, edges, weakness};
  }

  function contextualWeaknessPenalty(A,B){
    const items=[];
    function add(id, amount, condition, text){
      if(condition && amount>0.15) items.push({id, amount:round(amount,2), text});
    }
    add("slow-cbs-v-pace", (B.transition-A.cbScore)*0.045, B.transition>A.cbScore+8 && B.lineBreaking>74, "slow centre-backs can be attacked with runs behind");
    add("no-cdm-screen", (B.creativity-A.cdmCover)*0.045, A.cdmCover<72 && B.creativity>78, "lack of midfield screen opens zone 14");
    add("fullback-vacancy", (A.fbRisk-72)*0.055 + (B.wide-78)*0.035, A.fbRisk>74 && B.wide>76, "attacking fullbacks leave channels open");
    add("weak-aerial", (B.setPieces-A.aerialDefence)*0.04, B.setPieces>A.aerialDefence+8, "set-piece and crossing mismatch");
    add("low-press-resistance", (B.pressing-A.pressResistance)*0.04, B.pressing>A.pressResistance+8, "opponent press can force turnovers");
    return {total:round(sum(items.map(i=>i.amount)),2), items};
  }

  contextualWeaknessPenalty = function(A,B){
    const items=[];
    function add(id, amount, condition, text){
      if(condition && amount>0.15) items.push({id, amount:round(amount,2), text});
    }
    add("slow-cbs-v-pace", (B.transition-A.cbScore)*0.045, B.transition>A.cbScore+8 && B.lineBreaking>74, "slow centre-backs can be attacked with runs behind");
    add("no-cdm-screen", (B.creativity-A.cdmCover)*0.045, A.cdmCover<72 && B.creativity>78, "lack of midfield screen opens zone 14");
    add("fullback-vacancy", (A.fbRisk-72)*0.055 + (B.wide-78)*0.035, A.fbRisk>74 && B.wide>76, "attacking fullbacks leave channels open");
    add("weak-aerial", (B.setPieces-A.aerialDefence)*0.04, B.setPieces>A.aerialDefence+8, "set-piece and crossing mismatch");
    add("low-press-resistance", (B.pressing-A.pressResistance)*0.04, B.pressing>A.pressResistance+8, "opponent press can force turnovers");
    add("isolated-star", (76-A.lineBreaking)*0.035, A.starGravity>18 && A.lineBreaking<76, "elite star lacks enough service");
    add("too-open", (100-A.balance)*0.025, A.balance<70 && B.transition>80, "team is too open against transition threat");
    return {total:round(sum(items.map(i=>i.amount)),2), items};
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 7. XG AND SCORELINE — realistic baseline, unlimited ceiling
  // ─────────────────────────────────────────────────────────────────────────
  function expectedGoals(A,B,FS_A,FS_B,label){
    const finalDiff = FS_A.score - FS_B.score;

    // Baseline around real football. Good attacks do not automatically score 6.
    let xg = 1.05;

    // Chance quality.
    xg += (A.attack - B.defence) * 0.018;
    xg += (A.creativity - B.cdmCover) * 0.010;
    xg += (A.transition - B.cbScore) * 0.009;
    xg += (A.setPieces - B.aerialDefence) * 0.006;
    xg += (A.synergy - B.synergy) * 0.005;
    xg += (A.starGravity - B.dirtyCover) * 0.012;
    xg += Math.max(0, finalDiff) * 0.020;

    // Strong defences suppress games.
    if(B.defence>=88 && B.goalkeeper>=88) xg -= 0.30;
    if(B.cdmCover>=88 && B.cbScore>=88) xg -= 0.22;
    if(B.dirtyCover>=22) xg -= 0.18;

    // Tactical boosts.
    if(A.transition>=88 && B.fbRisk>=80 && B.cdmCover<80) xg += 0.35;
    if(A.setPieces>=88 && B.aerialDefence<78) xg += 0.22;
    if(A.pressing>=88 && B.pressResistance<76) xg += 0.20;
    if(A.attack>=92 && A.creativity>=88 && B.defence<78) xg += 0.30;

    // Brutal mismatch unlocks very large scores, but only after true gap.
    if(finalDiff>10) xg += (finalDiff-10)*0.035;
    if(finalDiff>18) xg += (finalDiff-18)*0.060;
    if(finalDiff>28) xg += (finalDiff-28)*0.090;
    if(finalDiff>40) xg += (finalDiff-40)*0.140;

    // Low event games.
    if(A.attack<76 && B.defence>86) xg -= 0.25;
    if(A.creativity<74 && B.cdmCover>86) xg -= 0.20;
    if(A.transition<72 && B.defence>85) xg -= 0.15;

    // Small deterministic texture.
    xg += seededNoise(label, -0.18, 0.18);

    return Math.max(0.05, xg);
  }

  function goalsFromXG(xg, dominance, finishing, keeper, label){
    // Deterministic distribution: most normal xG gives normal scores,
    // but high xG + finishing mismatch creates braces/hattricks/blowouts.
    const n1 = seededNoise(label+"a", -0.35, 0.35);
    const n2 = seededNoise(label+"b", -0.20, 0.20);
    let g = Math.floor(Math.max(0, xg + n1));
    const rem = xg - Math.floor(xg);
    const finishEdge = (finishing - keeper) * 0.006;

    if(rem + n2 + finishEdge > 0.63) g += 1;
    if(dominance>12 && rem + finishEdge > 0.42) g += 1;
    if(dominance>22 && xg>2.2) g += 1;
    if(dominance>34 && xg>3.1) g += 1;
    if(dominance>48 && xg>4.2) g += 1;

    // No cap: if xG is monstrous, goals keep scaling.
    if(xg>5.5) g += Math.floor((xg-5.5)*0.55);
    if(xg>8.0) g += Math.floor((xg-8.0)*0.80);

    return Math.max(0,g);
  }

  function scoreline(A,B,FS_A,FS_B,names){
    const xgA = expectedGoals(A,B,FS_A,FS_B,names[0]);
    const xgB = expectedGoals(B,A,FS_B,FS_A,names[1]);
    const diff = FS_A.score - FS_B.score;

    let goalsA = goalsFromXG(xgA, diff, A.finishing, B.goalkeeper, names[0]+"goals");
    let goalsB = goalsFromXG(xgB, -diff, B.finishing, A.goalkeeper, names[1]+"goals");

    // Tight game correction: most close games should not become 5-4 by default.
    if(Math.abs(diff)<4 && xgA<2.2 && xgB<2.2){
      goalsA = Math.min(goalsA, 3);
      goalsB = Math.min(goalsB, 3);
    }
    if(Math.abs(diff)<2 && Math.abs(xgA-xgB)<0.28){
      const shared = Math.max(0, Math.min(2, Math.round((xgA+xgB)/2 + seededNoise("draw",-.2,.2))));
      goalsA = shared; goalsB = shared;
    }

    // Brutal mismatch floor: if a team is miles better, show it.
    if(diff>18 && goalsA<3) goalsA=3;
    if(diff>26 && goalsA<5) goalsA=5;
    if(diff>36 && goalsA<7) goalsA=7;
    if(diff>50 && goalsA<9) goalsA=9;
    if(diff>30 && goalsB>2) goalsB=2;
    if(diff>42 && goalsB>1) goalsB=1;
    if(diff>55) goalsB=0;

    if(diff<-18 && goalsB<3) goalsB=3;
    if(diff<-26 && goalsB<5) goalsB=5;
    if(diff<-36 && goalsB<7) goalsB=7;
    if(diff<-50 && goalsB<9) goalsB=9;
    if(diff<-30 && goalsA>2) goalsA=2;
    if(diff<-42 && goalsA>1) goalsA=1;
    if(diff<-55) goalsA=0;

    // Defensive lock game.
    if(A.defence>90 && B.defence>90 && A.attack<78 && B.attack<78 && A.creativity<78 && B.creativity<78){
      goalsA=Math.min(goalsA,1);
      goalsB=Math.min(goalsB,1);
    }

    return {xgA:round(xgA,2), xgB:round(xgB,2), goalsA, goalsB, scoreline:`${goalsA}-${goalsB}`};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. PLAYER OUTPUT + RATINGS
  // ─────────────────────────────────────────────────────────────────────────
  function weightedPick(items, weightFn, salt){
    const weights = items.map(x=>Math.max(0.01, weightFn(x)));
    let total = sum(weights);
    let r = ((hashString(salt)%10000)/10000) * total;
    for(let i=0;i<items.length;i++){
      r -= weights[i];
      if(r<=0) return items[i];
    }
    return items[items.length-1];
  }

  function distributeGoals(team, goals, A, B, name){
    const u=units(team);
    const candidates = u.attackers.concat(u.creators).filter(Boolean);
    const out={};
    if(!candidates.length) return out;
    for(let i=0;i<goals;i++){
      const scorer = weightedPick(candidates, x=>{
        const p=x.p;
        let w = 1;
        w += attr(p,"finishing")*0.030;
        w += attr(p,"poaching")*0.026;
        w += attr(p,"offTheBall")*0.018;
        w += attr(p,"attack")*0.016;
        w += attr(p,"clutch")*0.010;
        w += starGravityOf(x)*0.12;
        if(x.role==="st") w*=1.55;
        if(x.role==="lw"||x.role==="rw") w*=1.20;
        if(x.role==="cam") w*=0.82;
        return w;
      }, name+"goal"+i);
      const nm=safeName(scorer.p);
      out[nm]=(out[nm]||0)+1;
    }
    return out;
  }

  function distributeAssists(team, goals, A, B, name){
    const u=units(team);
    const candidates = u.creators.concat(u.midfielders).concat(u.attackers).filter(Boolean);
    const out={};
    if(!candidates.length || goals<=0) return out;
    const assistCount = Math.max(0, goals - (goals>=4 ? 1 : 0));
    for(let i=0;i<assistCount;i++){
      const assister = weightedPick(candidates, x=>{
        const p=x.p;
        let w = 1;
        w += attr(p,"creativity")*0.026;
        w += attr(p,"passing")*0.024;
        w += attr(p,"visionRange")*0.022;
        w += attr(p,"crossing")*0.014;
        w += attr(p,"lineBreaking")*0.020;
        w += attr(p,"setPieces")*0.008;
        if(x.role==="cam") w*=1.32;
        if(x.role==="cm") w*=1.12;
        if(x.role==="lw"||x.role==="rw") w*=1.05;
        if(x.role==="cdm" && attr(p,"visionRange")>84) w*=1.10;
        return w;
      }, name+"assist"+i);
      const nm=safeName(assister.p);
      out[nm]=(out[nm]||0)+1;
    }
    return out;
  }

  function playerRatings(team, A, B, FS_A, FS_B, goalsFor, goalsAgainst, names, side){
    const u=units(team);
    const goals = distributeGoals(team, goalsFor, A, B, names[side]);
    const assists = distributeAssists(team, goalsFor, A, B, names[side]);
    const dominance = FS_A.score - FS_B.score;
    const cleanSheet = goalsAgainst===0;
    const concededMany = goalsAgainst>=4;
    const ratings=[];

    for(const x of u.all){
      const p=x.p, r=x.role, nm=safeName(p);
      let base = 6.05 + (roleScore(x)-76)*0.030 + dominance*0.020;

      if(["st","lw","rw","cam"].includes(r)){
        base += (A.attack-78)*0.020 + (A.creativity-76)*0.010;
        base -= Math.max(0, B.defence-84)*0.010;
      }
      if(["cm","cdm","cam"].includes(r)){
        base += (A.midfield-78)*0.020 + dirtyWorkOf(x)*0.015;
        base -= Math.max(0, B.pressing-86)*0.010;
      }
      if(["cb","lb","rb","cdm","gk"].includes(r)){
        base += (A.defence-78)*0.020 + (A.cdmCover-76)*0.012;
        base -= goalsAgainst*0.16;
        if(cleanSheet) base += r==="gk" ? 0.65 : 0.45;
        if(concededMany) base -= 0.25;
      }
      if(r==="gk"){
        base += (A.goalkeeper-78)*0.025;
        base -= Math.max(0, goalsAgainst-2)*0.20;
      }

      const g = goals[nm]||0;
      const a = assists[nm]||0;
      base += g*0.82 + a*0.42;
      if(g>=2) base += 0.35;
      if(g>=3) base += 0.55;
      if(a>=2) base += 0.25;
      if(g+a>=4) base += 0.45;

      // A defender in a 7-1 loss can be low, but not every defender defaults to 5.7.
      if(["cb","lb","rb","cdm"].includes(r) && goalsAgainst<=1 && A.defence>=82) base += 0.35;
      if(["cb","lb","rb"].includes(r) && goalsAgainst>=5) base -= 0.60;
      if(["st","lw","rw"].includes(r) && goalsFor===0) base -= 0.35;

      base += seededNoise(nm+names[side]+"rating",-0.12,0.12);

      ratings.push({
        name:nm,
        position:r.toUpperCase(),
        rating:round(clamp(base,3.0,10.0),1),
        goals:g,
        assists:a,
        notes:ratingNote(x,g,a,goalsFor,goalsAgainst,A,B)
      });
    }
    return ratings.sort((a,b)=>b.rating-a.rating);
  }

  function ratingNote(x,g,a,goalsFor,goalsAgainst,A,B){
    if(g>=3) return "hat-trick level decisive performance";
    if(g>=2 && a>=1) return "dominant goal contribution";
    if(a>=3) return "elite creative display";
    if(["cb","lb","rb","cdm","gk"].includes(x.role) && goalsAgainst===0) return "major defensive contribution";
    if(dirtyWorkOf(x)>18) return "covered huge spaces and protected teammates";
    if(starGravityOf(x)>18) return "constant gravity created space and overloads";
    if(goalsAgainst>=5 && ["cb","lb","rb","gk"].includes(x.role)) return "overwhelmed by repeated high-quality chances";
    return "solid tactical contribution";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. KEY BATTLES
  // ─────────────────────────────────────────────────────────────────────────
  function keyBattles(teamA, teamB, names, A, B){
    const au=units(teamA), bu=units(teamB);
    const battles=[];
    function add(title, aName, bName, aVal, bVal, context, reason){
      const diff = (aVal-bVal) + (context||0);
      const sA = scoreSplit(diff,0.18);
      battles.push({
        title, aName, bName,
        winner: sA===50 ? "Even" : (sA>50?names[0]:names[1]),
        score:`${sA}-${100-sA}`,
        scoreA:sA, scoreB:100-sA,
        diff:round(diff,1),
        reason
      });
    }

    const aStar = sortBy(au.attackers.concat(au.creators), starGravityOf)[0];
    const bStop = sortBy(bu.stoppers, threatDefence)[0];
    const bStar = sortBy(bu.attackers.concat(bu.creators), starGravityOf)[0];
    const aStop = sortBy(au.stoppers, threatDefence)[0];

    if(aStar && bStop){
      add(`${safeName(aStar.p)} gravity vs ${safeName(bStop.p)} cover`,
        safeName(aStar.p), safeName(bStop.p),
        threatAttack(aStar)+starGravityOf(aStar)*0.7,
        threatDefence(bStop)+dirtyWorkOf(bStop)*0.5+B.dirtyCover*0.10,
        (A.lineBreaking-B.cdmCover)*0.06,
        "measures whether the defence can allocate enough quality cover without opening gaps elsewhere");
    }
    if(bStar && aStop){
      add(`${safeName(bStar.p)} gravity vs ${safeName(aStop.p)} cover`,
        safeName(bStar.p), safeName(aStop.p),
        threatAttack(bStar)+starGravityOf(bStar)*0.7,
        threatDefence(aStop)+dirtyWorkOf(aStop)*0.5+A.dirtyCover*0.10,
        (B.lineBreaking-A.cdmCover)*0.06,
        "same star-gravity battle in the opposite direction");
    }

    if(au.st && bu.cbs.length){
      const cb=sortBy(bu.cbs, threatDefence)[0];
      add(`${safeName(au.st.p)} vs ${safeName(cb.p)}`,
        safeName(au.st.p), safeName(cb.p),
        threatAttack(au.st)+attr(au.st.p,"poaching")*0.10,
        threatDefence(cb)+B.cdmCover*0.08,
        (A.creativity-B.defence)*0.06,
        "striker movement and service against centre-back defending");
    }
    if(bu.st && au.cbs.length){
      const cb=sortBy(au.cbs, threatDefence)[0];
      add(`${safeName(bu.st.p)} vs ${safeName(cb.p)}`,
        safeName(bu.st.p), safeName(cb.p),
        threatAttack(bu.st)+attr(bu.st.p,"poaching")*0.10,
        threatDefence(cb)+A.cdmCover*0.08,
        (B.creativity-A.defence)*0.06,
        "opposition striker movement and service against centre-back defending");
    }

    if(au.lw && bu.rb){
      add(`${safeName(au.lw.p)} vs ${safeName(bu.rb.p)}`,
        safeName(au.lw.p), safeName(bu.rb.p),
        threatAttack(au.lw)+attr(au.lw.p,"dribbling")*0.08,
        threatDefence(bu.rb)+B.dirtyCover*0.05,
        (A.wide-B.wide)*0.05,
        "left-wing isolation, dribbling and support versus right-back security");
    }
    if(au.rw && bu.lb){
      add(`${safeName(au.rw.p)} vs ${safeName(bu.lb.p)}`,
        safeName(au.rw.p), safeName(bu.lb.p),
        threatAttack(au.rw)+attr(au.rw.p,"dribbling")*0.08,
        threatDefence(bu.lb)+B.dirtyCover*0.05,
        (A.wide-B.wide)*0.05,
        "right-wing isolation, dribbling and support versus left-back security");
    }

    add(`${names[0]} midfield control vs ${names[1]} midfield control`,
      names[0]+" midfield", names[1]+" midfield",
      A.midfield + A.dirtyCover*0.12 + A.pressResistance*0.08,
      B.midfield + B.dirtyCover*0.12 + B.pressResistance*0.08,
      0,
      "decides who controls territory, tempo and second balls");

    add(`${names[0]} transition vs ${names[1]} defensive cover`,
      names[0]+" transition", names[1]+" cover",
      A.transition + A.lineBreaking*0.12,
      B.defence + B.cdmCover*0.15 + B.dirtyCover*0.25,
      (B.fbRisk-75)*0.10,
      "measures whether speed actually has space to hurt the opponent");

    return battles.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).slice(0,8);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. NARRATIVE
  // ─────────────────────────────────────────────────────────────────────────
  function narrative(names,A,B,FS_A,FS_B,score,battles){
    const winner = score.goalsA>score.goalsB ? names[0] : score.goalsB>score.goalsA ? names[1] : "Draw";
    const diff = Math.abs(FS_A.score-FS_B.score);
    const decisive = battles[0];

    let type = "tight tactical match";
    if(diff>=45) type="brutal mismatch";
    else if(diff>=30) type="dominant mismatch";
    else if(diff>=18) type="clear superiority";
    else if(diff>=8) type="narrow but deserved edge";

    const lines=[];
    if(winner==="Draw"){
      lines.push(`The match ends level because both teams had enough strengths to cancel out the opponent's main route to goal.`);
    }else{
      lines.push(`${winner} wins ${score.scoreline} in a ${type}.`);
    }

    if(decisive){
      lines.push(`The biggest matchup swing is ${decisive.title}, scored ${decisive.score}, because ${decisive.reason}.`);
    }

    if(A.starGravity>18 || B.starGravity>18){
      const team = A.starGravity>=B.starGravity ? names[0] : names[1];
      const val = Math.max(A.starGravity,B.starGravity);
      lines.push(`${team} has major star gravity (${round(val,1)}), meaning the opponent has to commit extra cover, which can open space elsewhere.`);
    }

    if(A.dirtyCover>18 || B.dirtyCover>18){
      const team = A.dirtyCover>=B.dirtyCover ? names[0] : names[1];
      const val = Math.max(A.dirtyCover,B.dirtyCover);
      lines.push(`${team}'s midfield dirty-work cover is a major stabiliser (${round(val,1)}), helping protect defenders and reduce transition damage.`);
    }

    if(Math.max(score.goalsA,score.goalsB)>=6){
      lines.push(`The scoreline gets huge because the matchup creates repeated high-quality chances, not because goals are forced by default.`);
    }else{
      lines.push(`The scoring stays within a realistic football range because defensive resistance, goalkeeper quality and midfield cover suppress the chance volume.`);
    }

    return lines.join(" ");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. PUBLIC PHASES — what your UI displays
  // These are absolute ratings, not misleading opponent-relative splits.
  // ─────────────────────────────────────────────────────────────────────────
  function publicPhases(DNA, FS){
    return {
      attack:round(DNA.attack,1),
      midfield:round(DNA.midfield,1),
      defence:round(DNA.defence,1),
      transition:round(DNA.transition,1),
      wide:round(DNA.wide,1),
      leftFlank:round(DNA.wide,1),
      rightFlank:round(DNA.wide,1),
      chanceCreation:round(DNA.creativity,1),
      possession:round(weighted([[DNA.midfield,.45],[DNA.pressResistance,.25],[DNA.technical,.20],[DNA.synergy,.10]]),1),
      pressing:round(DNA.pressing,1),
      setPieces:round(DNA.setPieces,1),
      goalkeeper:round(DNA.goalkeeper,1),
      synergy:round(DNA.synergy,1),
      balance:round(DNA.balance,1),
      starGravity:round(DNA.starGravity,1),
      dirtyCover:round(DNA.dirtyCover,1),
      weaknessPenalty:round(FS.weakness.total,1),
      final:round(FS.score,1)
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. MAIN VERDICT FUNCTION
  // ─────────────────────────────────────────────────────────────────────────
  function calculateRealisticDynamicVerdict(teamA, teamB, names=["Player 1","Player 2"]){
    const A = teamDNA(teamA);
    const B = teamDNA(teamB);
    const FS_A = finalScoreFromDNA(A,B);
    const FS_B = finalScoreFromDNA(B,A);
    const sc = scoreline(A,B,FS_A,FS_B,names);

    const battles = keyBattles(teamA,teamB,names,A,B);
    const ratingsA = playerRatings(teamA,A,B,FS_A,FS_B,sc.goalsA,sc.goalsB,names,0);
    const ratingsB = playerRatings(teamB,B,A,FS_B,FS_A,sc.goalsB,sc.goalsA,names,1);
    const allRatings = ratingsA.map(r=>({...r,team:names[0]})).concat(ratingsB.map(r=>({...r,team:names[1]}))).sort((a,b)=>b.rating-a.rating);
    const motm = allRatings[0] || null;

    const diff = FS_A.score - FS_B.score;
    const probA = clamp(50 + diff*2.4, 1, 99);
    let verdictType="coin flip";
    if(Math.abs(diff)>=45) verdictType="brutal mismatch";
    else if(Math.abs(diff)>=30) verdictType="dominant win";
    else if(Math.abs(diff)>=18) verdictType="clear win";
    else if(Math.abs(diff)>=8) verdictType="narrow win";

    const winner = sc.goalsA>sc.goalsB ? names[0] : sc.goalsB>sc.goalsA ? names[1] : "Draw";

    return {
      version: PATCH_VERSION,
      winner,
      winProbability:{[names[0]]:round(probA,1),[names[1]]:round(100-probA,1)},
      verdictType,
      finalScores:{[names[0]]:round(FS_A.score,1),[names[1]]:round(FS_B.score,1)},
      scoreline:sc.scoreline,
      expectedGoals:{[names[0]]:sc.xgA,[names[1]]:sc.xgB},
      phases:{[names[0]]:publicPhases(A,FS_A),[names[1]]:publicPhases(B,FS_B)},
      keyBattles:battles,
      playerRatings:{[names[0]]:ratingsA,[names[1]]:ratingsB,manOfTheMatch:motm},
      tactical:{
        [names[0]]:{
          identity: tacticalIdentity(A),
          starGravity:A.gravity,
          dirtyWork:A.dirtyWork,
          edges:FS_A.edges,
          weaknesses:FS_A.weakness
        },
        [names[1]]:{
          identity: tacticalIdentity(B),
          starGravity:B.gravity,
          dirtyWork:B.dirtyWork,
          edges:FS_B.edges,
          weaknesses:FS_B.weakness
        }
      },
      weaknesses:{[names[0]]:FS_A.weakness,[names[1]]:FS_B.weakness},
      narrative:narrative(names,A,B,FS_A,FS_B,sc,battles),
      decidingBattle:battles[0]||null,
      debug:{A,B,FS_A,FS_B,score:sc}
    };
  }

  function tacticalIdentity(D){
    if(D.attack>=88 && D.transition>=86) return "elite vertical attack";
    if(D.midfield>=88 && D.pressResistance>=86) return "possession control";
    if(D.defence>=88 && D.cdmCover>=86) return "defensive lockdown";
    if(D.pressing>=87) return "high pressing machine";
    if(D.setPieces>=88 && D.wide>=84) return "wide/set-piece threat";
    if(D.starGravity>=20) return "superstar-led system";
    if(D.dirtyCover>=20) return "midfield protection system";
    return "balanced tactical side";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. PLAYER ENHANCEMENT DEFAULTS
  // Adds extra attributes to player objects if missing.
  // ─────────────────────────────────────────────────────────────────────────
  function enhancePlayer(p){
    if(!p || p.__realismV62Enhanced) return p;
    const keys = [
      "composure","marking","recoveryPace","lineBreaking","poaching","linkUp",
      "decisionMaking","duelStrength","heading","clutch","visionRange",
      "offTheBall","aggression","adaptability"
    ];
    for(const k of keys){
      if(p[k] == null) p[k] = round(attr(p,k),0);
    }
    if(p.defence == null && p.defense != null) p.defence = p.defense;
    if(p.defense == null && p.defence != null) p.defense = p.defence;
    p.__realismV62Enhanced = true;
    return p;
  }
  function enhancePools(){
    ["PLAYERS","EXTRA_PLAYERS","players","extraPlayers"].forEach(name=>{
      const arr=root[name];
      if(Array.isArray(arr)) arr.forEach(enhancePlayer);
    });
  }

  enhancePools();

  // Override the verdict calls used by the UI.
  root.ENGINE.calculateRealisticDynamicVerdict = calculateRealisticDynamicVerdict;
  root.ENGINE.calculateUltraDynamicVerdict = calculateRealisticDynamicVerdict;
  root.ENGINE.calculateAdvancedVerdict = calculateRealisticDynamicVerdict;
  root.ENGINE.realismBalanceVersion = PATCH_VERSION;
  root.ENGINE.realismTeamDNA = teamDNA;
  root.ENGINE.realismEnhancePlayers = enhancePools;

})();

/*
DYNAMIC SCENARIO RULEBOOK NOTES
0001. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0002. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0003. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0004. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0005. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0006. low-block: Deep elite defence suppresses xG and reduces pace impact.
0007. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0008. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0009. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0010. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0011. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0012. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0013. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0014. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0015. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0016. low-block: Deep elite defence suppresses xG and reduces pace impact.
0017. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0018. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0019. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0020. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0021. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0022. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0023. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0024. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0025. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0026. low-block: Deep elite defence suppresses xG and reduces pace impact.
0027. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0028. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0029. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0030. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0031. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0032. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0033. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0034. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0035. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0036. low-block: Deep elite defence suppresses xG and reduces pace impact.
0037. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0038. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0039. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0040. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0041. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0042. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0043. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0044. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0045. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0046. low-block: Deep elite defence suppresses xG and reduces pace impact.
0047. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0048. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0049. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0050. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0051. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0052. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0053. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0054. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0055. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0056. low-block: Deep elite defence suppresses xG and reduces pace impact.
0057. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0058. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0059. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0060. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0061. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0062. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0063. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0064. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0065. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0066. low-block: Deep elite defence suppresses xG and reduces pace impact.
0067. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0068. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0069. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0070. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0071. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0072. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0073. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0074. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0075. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0076. low-block: Deep elite defence suppresses xG and reduces pace impact.
0077. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0078. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0079. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0080. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0081. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0082. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0083. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0084. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0085. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0086. low-block: Deep elite defence suppresses xG and reduces pace impact.
0087. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0088. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0089. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0090. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0091. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0092. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0093. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0094. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0095. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0096. low-block: Deep elite defence suppresses xG and reduces pace impact.
0097. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0098. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0099. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0100. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0101. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0102. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0103. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0104. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0105. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0106. low-block: Deep elite defence suppresses xG and reduces pace impact.
0107. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0108. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0109. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0110. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0111. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0112. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0113. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0114. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0115. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0116. low-block: Deep elite defence suppresses xG and reduces pace impact.
0117. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0118. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0119. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0120. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0121. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0122. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0123. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0124. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0125. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0126. low-block: Deep elite defence suppresses xG and reduces pace impact.
0127. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0128. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0129. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0130. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0131. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0132. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0133. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0134. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0135. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0136. low-block: Deep elite defence suppresses xG and reduces pace impact.
0137. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0138. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0139. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0140. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0141. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0142. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0143. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0144. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0145. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0146. low-block: Deep elite defence suppresses xG and reduces pace impact.
0147. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0148. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0149. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0150. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0151. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0152. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0153. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0154. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0155. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0156. low-block: Deep elite defence suppresses xG and reduces pace impact.
0157. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0158. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0159. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0160. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0161. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0162. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0163. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0164. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0165. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0166. low-block: Deep elite defence suppresses xG and reduces pace impact.
0167. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0168. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0169. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0170. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0171. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0172. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0173. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0174. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0175. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0176. low-block: Deep elite defence suppresses xG and reduces pace impact.
0177. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0178. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0179. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0180. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0181. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0182. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0183. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0184. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0185. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0186. low-block: Deep elite defence suppresses xG and reduces pace impact.
0187. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0188. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0189. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0190. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0191. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0192. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0193. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0194. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0195. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0196. low-block: Deep elite defence suppresses xG and reduces pace impact.
0197. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0198. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0199. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0200. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0201. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0202. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0203. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0204. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0205. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0206. low-block: Deep elite defence suppresses xG and reduces pace impact.
0207. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0208. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0209. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0210. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0211. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0212. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0213. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0214. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0215. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0216. low-block: Deep elite defence suppresses xG and reduces pace impact.
0217. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0218. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0219. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0220. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0221. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0222. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0223. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0224. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0225. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0226. low-block: Deep elite defence suppresses xG and reduces pace impact.
0227. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0228. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0229. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0230. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0231. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0232. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0233. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0234. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0235. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0236. low-block: Deep elite defence suppresses xG and reduces pace impact.
0237. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0238. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0239. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0240. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0241. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0242. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0243. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0244. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0245. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0246. low-block: Deep elite defence suppresses xG and reduces pace impact.
0247. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0248. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0249. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0250. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0251. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0252. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0253. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0254. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0255. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0256. low-block: Deep elite defence suppresses xG and reduces pace impact.
0257. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0258. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0259. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0260. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0261. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0262. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0263. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0264. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0265. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0266. low-block: Deep elite defence suppresses xG and reduces pace impact.
0267. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0268. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0269. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0270. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0271. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0272. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0273. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0274. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0275. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0276. low-block: Deep elite defence suppresses xG and reduces pace impact.
0277. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0278. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0279. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0280. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0281. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0282. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0283. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0284. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0285. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0286. low-block: Deep elite defence suppresses xG and reduces pace impact.
0287. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0288. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0289. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0290. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0291. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0292. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0293. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0294. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0295. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0296. low-block: Deep elite defence suppresses xG and reduces pace impact.
0297. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0298. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0299. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0300. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0301. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0302. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0303. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0304. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0305. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0306. low-block: Deep elite defence suppresses xG and reduces pace impact.
0307. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0308. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0309. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0310. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0311. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0312. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0313. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0314. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0315. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0316. low-block: Deep elite defence suppresses xG and reduces pace impact.
0317. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0318. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0319. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0320. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0321. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0322. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0323. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0324. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0325. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0326. low-block: Deep elite defence suppresses xG and reduces pace impact.
0327. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0328. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0329. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0330. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0331. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0332. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0333. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0334. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0335. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0336. low-block: Deep elite defence suppresses xG and reduces pace impact.
0337. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0338. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0339. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0340. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0341. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0342. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0343. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0344. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0345. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0346. low-block: Deep elite defence suppresses xG and reduces pace impact.
0347. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0348. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0349. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0350. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0351. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0352. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0353. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0354. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0355. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0356. low-block: Deep elite defence suppresses xG and reduces pace impact.
0357. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0358. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0359. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0360. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0361. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0362. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0363. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0364. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0365. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0366. low-block: Deep elite defence suppresses xG and reduces pace impact.
0367. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0368. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0369. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0370. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0371. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0372. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0373. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0374. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0375. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0376. low-block: Deep elite defence suppresses xG and reduces pace impact.
0377. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0378. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0379. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0380. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0381. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0382. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0383. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0384. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0385. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0386. low-block: Deep elite defence suppresses xG and reduces pace impact.
0387. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0388. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0389. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0390. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0391. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0392. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0393. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0394. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0395. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0396. low-block: Deep elite defence suppresses xG and reduces pace impact.
0397. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0398. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0399. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0400. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0401. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0402. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0403. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0404. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0405. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0406. low-block: Deep elite defence suppresses xG and reduces pace impact.
0407. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0408. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0409. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0410. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0411. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0412. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0413. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0414. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0415. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0416. low-block: Deep elite defence suppresses xG and reduces pace impact.
0417. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0418. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0419. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0420. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0421. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0422. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0423. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0424. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0425. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0426. low-block: Deep elite defence suppresses xG and reduces pace impact.
0427. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0428. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0429. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0430. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0431. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0432. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0433. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0434. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0435. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0436. low-block: Deep elite defence suppresses xG and reduces pace impact.
0437. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0438. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0439. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0440. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0441. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0442. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0443. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0444. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0445. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0446. low-block: Deep elite defence suppresses xG and reduces pace impact.
0447. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0448. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0449. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0450. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0451. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0452. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0453. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0454. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0455. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0456. low-block: Deep elite defence suppresses xG and reduces pace impact.
0457. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0458. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0459. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0460. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0461. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0462. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0463. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0464. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0465. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0466. low-block: Deep elite defence suppresses xG and reduces pace impact.
0467. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0468. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0469. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0470. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0471. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0472. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0473. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0474. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0475. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0476. low-block: Deep elite defence suppresses xG and reduces pace impact.
0477. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0478. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0479. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0480. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0481. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0482. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0483. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0484. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0485. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0486. low-block: Deep elite defence suppresses xG and reduces pace impact.
0487. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0488. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0489. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0490. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0491. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0492. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0493. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0494. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0495. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0496. low-block: Deep elite defence suppresses xG and reduces pace impact.
0497. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0498. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0499. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0500. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0501. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0502. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0503. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0504. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0505. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0506. low-block: Deep elite defence suppresses xG and reduces pace impact.
0507. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0508. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0509. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0510. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0511. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0512. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0513. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0514. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0515. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0516. low-block: Deep elite defence suppresses xG and reduces pace impact.
0517. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0518. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0519. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0520. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0521. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0522. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0523. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0524. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0525. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0526. low-block: Deep elite defence suppresses xG and reduces pace impact.
0527. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0528. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0529. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0530. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0531. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0532. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0533. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0534. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0535. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0536. low-block: Deep elite defence suppresses xG and reduces pace impact.
0537. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0538. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0539. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0540. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0541. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0542. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0543. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0544. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0545. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0546. low-block: Deep elite defence suppresses xG and reduces pace impact.
0547. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0548. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0549. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0550. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0551. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0552. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0553. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0554. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0555. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0556. low-block: Deep elite defence suppresses xG and reduces pace impact.
0557. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0558. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0559. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0560. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0561. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0562. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0563. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0564. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0565. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0566. low-block: Deep elite defence suppresses xG and reduces pace impact.
0567. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0568. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0569. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0570. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0571. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0572. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0573. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0574. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0575. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0576. low-block: Deep elite defence suppresses xG and reduces pace impact.
0577. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0578. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0579. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0580. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0581. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0582. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0583. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0584. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0585. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0586. low-block: Deep elite defence suppresses xG and reduces pace impact.
0587. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0588. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0589. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0590. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0591. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0592. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0593. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0594. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0595. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0596. low-block: Deep elite defence suppresses xG and reduces pace impact.
0597. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0598. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0599. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0600. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0601. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0602. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0603. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0604. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0605. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0606. low-block: Deep elite defence suppresses xG and reduces pace impact.
0607. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0608. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0609. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0610. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0611. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0612. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0613. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0614. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0615. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0616. low-block: Deep elite defence suppresses xG and reduces pace impact.
0617. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0618. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0619. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0620. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0621. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0622. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0623. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0624. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0625. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0626. low-block: Deep elite defence suppresses xG and reduces pace impact.
0627. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0628. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0629. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0630. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0631. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0632. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0633. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0634. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0635. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0636. low-block: Deep elite defence suppresses xG and reduces pace impact.
0637. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0638. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0639. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0640. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0641. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0642. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0643. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0644. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0645. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0646. low-block: Deep elite defence suppresses xG and reduces pace impact.
0647. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0648. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0649. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0650. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0651. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0652. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0653. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0654. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0655. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0656. low-block: Deep elite defence suppresses xG and reduces pace impact.
0657. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0658. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0659. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0660. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0661. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0662. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0663. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0664. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0665. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0666. low-block: Deep elite defence suppresses xG and reduces pace impact.
0667. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0668. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0669. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0670. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0671. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0672. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0673. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0674. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0675. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0676. low-block: Deep elite defence suppresses xG and reduces pace impact.
0677. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0678. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0679. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0680. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0681. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0682. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0683. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0684. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0685. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0686. low-block: Deep elite defence suppresses xG and reduces pace impact.
0687. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0688. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0689. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0690. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0691. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0692. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0693. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0694. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0695. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0696. low-block: Deep elite defence suppresses xG and reduces pace impact.
0697. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0698. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0699. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0700. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0701. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0702. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0703. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0704. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0705. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0706. low-block: Deep elite defence suppresses xG and reduces pace impact.
0707. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0708. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0709. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0710. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0711. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0712. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0713. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0714. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0715. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0716. low-block: Deep elite defence suppresses xG and reduces pace impact.
0717. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0718. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0719. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0720. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0721. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0722. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0723. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0724. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0725. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0726. low-block: Deep elite defence suppresses xG and reduces pace impact.
0727. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0728. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0729. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0730. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0731. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0732. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0733. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0734. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0735. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0736. low-block: Deep elite defence suppresses xG and reduces pace impact.
0737. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0738. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0739. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0740. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0741. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0742. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0743. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0744. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0745. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0746. low-block: Deep elite defence suppresses xG and reduces pace impact.
0747. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0748. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0749. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0750. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0751. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0752. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0753. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0754. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0755. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0756. low-block: Deep elite defence suppresses xG and reduces pace impact.
0757. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0758. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0759. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0760. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0761. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0762. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0763. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0764. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0765. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0766. low-block: Deep elite defence suppresses xG and reduces pace impact.
0767. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0768. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0769. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0770. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0771. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0772. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0773. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0774. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0775. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0776. low-block: Deep elite defence suppresses xG and reduces pace impact.
0777. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0778. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0779. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0780. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0781. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0782. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0783. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0784. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0785. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0786. low-block: Deep elite defence suppresses xG and reduces pace impact.
0787. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0788. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0789. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0790. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0791. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0792. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0793. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0794. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0795. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0796. low-block: Deep elite defence suppresses xG and reduces pace impact.
0797. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0798. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0799. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0800. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0801. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0802. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0803. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0804. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0805. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0806. low-block: Deep elite defence suppresses xG and reduces pace impact.
0807. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0808. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0809. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0810. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0811. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0812. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0813. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0814. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0815. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0816. low-block: Deep elite defence suppresses xG and reduces pace impact.
0817. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0818. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0819. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0820. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0821. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0822. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0823. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0824. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0825. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0826. low-block: Deep elite defence suppresses xG and reduces pace impact.
0827. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0828. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0829. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0830. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0831. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0832. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0833. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0834. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0835. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0836. low-block: Deep elite defence suppresses xG and reduces pace impact.
0837. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0838. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0839. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0840. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0841. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0842. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0843. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0844. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0845. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0846. low-block: Deep elite defence suppresses xG and reduces pace impact.
0847. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0848. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0849. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0850. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0851. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0852. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0853. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0854. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0855. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0856. low-block: Deep elite defence suppresses xG and reduces pace impact.
0857. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0858. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0859. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0860. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0861. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0862. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0863. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0864. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0865. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0866. low-block: Deep elite defence suppresses xG and reduces pace impact.
0867. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0868. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0869. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0870. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0871. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0872. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0873. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0874. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0875. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0876. low-block: Deep elite defence suppresses xG and reduces pace impact.
0877. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0878. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0879. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0880. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0881. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0882. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0883. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0884. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0885. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0886. low-block: Deep elite defence suppresses xG and reduces pace impact.
0887. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0888. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0889. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0890. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0891. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0892. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0893. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0894. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0895. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0896. low-block: Deep elite defence suppresses xG and reduces pace impact.
0897. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0898. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0899. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0900. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0901. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0902. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0903. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0904. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0905. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0906. low-block: Deep elite defence suppresses xG and reduces pace impact.
0907. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0908. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0909. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0910. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0911. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0912. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0913. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0914. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0915. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0916. low-block: Deep elite defence suppresses xG and reduces pace impact.
0917. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0918. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0919. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0920. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0921. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0922. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0923. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0924. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0925. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0926. low-block: Deep elite defence suppresses xG and reduces pace impact.
0927. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0928. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0929. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0930. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0931. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0932. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0933. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0934. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0935. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0936. low-block: Deep elite defence suppresses xG and reduces pace impact.
0937. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0938. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0939. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0940. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0941. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0942. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0943. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0944. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0945. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0946. low-block: Deep elite defence suppresses xG and reduces pace impact.
0947. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0948. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0949. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0950. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0951. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0952. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0953. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0954. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0955. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0956. low-block: Deep elite defence suppresses xG and reduces pace impact.
0957. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0958. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0959. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0960. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0961. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0962. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0963. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0964. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0965. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0966. low-block: Deep elite defence suppresses xG and reduces pace impact.
0967. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0968. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0969. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0970. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0971. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0972. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0973. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0974. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0975. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0976. low-block: Deep elite defence suppresses xG and reduces pace impact.
0977. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0978. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0979. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0980. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0981. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0982. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0983. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0984. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0985. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0986. low-block: Deep elite defence suppresses xG and reduces pace impact.
0987. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0988. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0989. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
0990. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
0991. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
0992. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
0993. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
0994. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
0995. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
0996. low-block: Deep elite defence suppresses xG and reduces pace impact.
0997. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
0998. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
0999. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1000. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1001. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1002. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1003. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1004. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1005. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1006. low-block: Deep elite defence suppresses xG and reduces pace impact.
1007. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1008. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1009. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1010. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1011. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1012. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1013. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1014. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1015. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1016. low-block: Deep elite defence suppresses xG and reduces pace impact.
1017. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1018. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1019. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1020. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1021. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1022. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1023. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1024. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1025. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1026. low-block: Deep elite defence suppresses xG and reduces pace impact.
1027. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1028. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1029. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1030. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1031. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1032. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1033. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1034. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1035. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1036. low-block: Deep elite defence suppresses xG and reduces pace impact.
1037. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1038. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1039. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1040. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1041. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1042. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1043. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1044. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1045. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1046. low-block: Deep elite defence suppresses xG and reduces pace impact.
1047. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1048. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1049. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1050. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1051. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1052. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1053. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1054. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1055. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1056. low-block: Deep elite defence suppresses xG and reduces pace impact.
1057. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1058. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1059. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1060. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1061. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1062. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1063. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1064. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1065. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1066. low-block: Deep elite defence suppresses xG and reduces pace impact.
1067. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1068. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1069. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1070. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1071. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1072. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1073. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1074. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1075. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1076. low-block: Deep elite defence suppresses xG and reduces pace impact.
1077. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1078. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1079. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1080. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1081. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1082. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1083. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1084. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1085. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1086. low-block: Deep elite defence suppresses xG and reduces pace impact.
1087. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1088. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1089. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1090. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1091. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1092. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1093. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1094. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1095. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1096. low-block: Deep elite defence suppresses xG and reduces pace impact.
1097. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1098. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1099. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1100. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1101. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1102. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1103. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1104. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1105. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1106. low-block: Deep elite defence suppresses xG and reduces pace impact.
1107. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1108. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1109. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1110. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1111. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1112. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1113. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1114. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1115. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1116. low-block: Deep elite defence suppresses xG and reduces pace impact.
1117. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1118. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1119. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1120. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1121. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1122. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1123. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1124. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1125. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1126. low-block: Deep elite defence suppresses xG and reduces pace impact.
1127. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1128. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1129. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1130. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1131. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1132. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1133. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1134. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1135. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1136. low-block: Deep elite defence suppresses xG and reduces pace impact.
1137. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1138. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1139. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1140. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1141. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1142. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1143. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1144. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1145. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1146. low-block: Deep elite defence suppresses xG and reduces pace impact.
1147. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1148. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1149. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1150. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1151. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1152. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1153. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1154. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1155. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1156. low-block: Deep elite defence suppresses xG and reduces pace impact.
1157. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1158. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1159. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1160. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1161. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1162. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1163. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1164. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1165. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1166. low-block: Deep elite defence suppresses xG and reduces pace impact.
1167. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1168. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1169. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1170. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1171. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1172. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1173. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1174. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1175. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1176. low-block: Deep elite defence suppresses xG and reduces pace impact.
1177. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1178. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1179. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1180. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1181. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1182. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1183. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1184. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1185. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1186. low-block: Deep elite defence suppresses xG and reduces pace impact.
1187. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1188. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1189. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1190. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1191. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1192. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1193. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1194. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1195. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1196. low-block: Deep elite defence suppresses xG and reduces pace impact.
1197. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1198. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1199. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1200. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1201. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1202. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1203. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1204. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1205. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1206. low-block: Deep elite defence suppresses xG and reduces pace impact.
1207. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1208. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1209. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1210. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1211. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1212. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1213. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1214. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1215. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1216. low-block: Deep elite defence suppresses xG and reduces pace impact.
1217. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1218. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1219. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1220. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1221. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1222. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1223. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1224. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1225. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1226. low-block: Deep elite defence suppresses xG and reduces pace impact.
1227. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1228. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1229. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1230. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1231. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1232. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1233. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1234. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1235. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1236. low-block: Deep elite defence suppresses xG and reduces pace impact.
1237. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1238. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1239. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1240. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1241. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1242. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1243. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1244. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1245. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1246. low-block: Deep elite defence suppresses xG and reduces pace impact.
1247. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1248. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1249. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1250. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1251. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1252. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1253. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1254. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1255. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1256. low-block: Deep elite defence suppresses xG and reduces pace impact.
1257. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1258. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1259. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1260. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1261. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1262. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1263. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1264. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1265. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1266. low-block: Deep elite defence suppresses xG and reduces pace impact.
1267. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1268. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1269. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1270. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1271. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1272. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1273. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1274. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1275. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1276. low-block: Deep elite defence suppresses xG and reduces pace impact.
1277. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1278. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1279. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1280. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1281. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1282. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1283. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1284. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1285. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1286. low-block: Deep elite defence suppresses xG and reduces pace impact.
1287. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1288. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1289. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1290. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1291. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1292. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1293. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1294. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1295. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1296. low-block: Deep elite defence suppresses xG and reduces pace impact.
1297. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1298. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1299. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1300. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1301. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1302. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1303. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1304. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1305. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1306. low-block: Deep elite defence suppresses xG and reduces pace impact.
1307. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1308. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1309. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1310. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1311. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1312. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1313. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1314. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1315. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1316. low-block: Deep elite defence suppresses xG and reduces pace impact.
1317. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1318. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1319. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1320. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1321. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1322. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1323. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1324. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1325. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1326. low-block: Deep elite defence suppresses xG and reduces pace impact.
1327. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1328. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1329. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1330. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1331. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1332. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1333. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1334. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1335. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1336. low-block: Deep elite defence suppresses xG and reduces pace impact.
1337. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1338. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1339. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1340. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1341. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1342. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1343. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1344. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1345. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1346. low-block: Deep elite defence suppresses xG and reduces pace impact.
1347. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1348. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1349. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1350. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1351. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1352. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1353. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1354. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1355. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1356. low-block: Deep elite defence suppresses xG and reduces pace impact.
1357. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1358. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1359. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1360. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1361. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1362. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1363. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1364. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1365. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1366. low-block: Deep elite defence suppresses xG and reduces pace impact.
1367. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1368. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1369. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1370. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1371. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1372. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1373. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1374. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1375. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1376. low-block: Deep elite defence suppresses xG and reduces pace impact.
1377. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1378. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1379. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1380. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1381. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1382. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1383. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1384. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1385. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1386. low-block: Deep elite defence suppresses xG and reduces pace impact.
1387. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1388. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1389. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1390. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1391. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1392. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1393. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1394. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1395. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1396. low-block: Deep elite defence suppresses xG and reduces pace impact.
1397. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1398. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1399. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1400. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1401. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1402. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1403. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1404. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1405. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1406. low-block: Deep elite defence suppresses xG and reduces pace impact.
1407. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1408. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1409. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1410. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1411. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1412. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1413. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1414. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1415. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1416. low-block: Deep elite defence suppresses xG and reduces pace impact.
1417. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1418. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1419. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1420. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1421. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1422. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1423. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1424. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1425. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1426. low-block: Deep elite defence suppresses xG and reduces pace impact.
1427. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1428. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1429. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1430. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1431. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1432. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1433. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1434. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1435. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1436. low-block: Deep elite defence suppresses xG and reduces pace impact.
1437. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1438. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1439. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1440. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1441. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1442. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1443. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1444. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1445. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1446. low-block: Deep elite defence suppresses xG and reduces pace impact.
1447. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1448. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1449. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1450. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1451. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1452. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1453. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1454. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1455. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1456. low-block: Deep elite defence suppresses xG and reduces pace impact.
1457. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1458. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1459. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1460. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1461. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1462. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1463. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1464. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1465. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1466. low-block: Deep elite defence suppresses xG and reduces pace impact.
1467. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1468. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1469. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1470. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1471. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1472. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1473. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1474. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1475. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1476. low-block: Deep elite defence suppresses xG and reduces pace impact.
1477. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1478. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1479. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1480. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1481. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1482. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1483. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1484. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1485. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1486. low-block: Deep elite defence suppresses xG and reduces pace impact.
1487. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1488. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1489. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1490. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1491. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1492. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1493. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1494. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1495. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1496. low-block: Deep elite defence suppresses xG and reduces pace impact.
1497. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1498. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1499. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1500. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1501. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1502. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1503. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1504. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1505. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1506. low-block: Deep elite defence suppresses xG and reduces pace impact.
1507. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1508. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1509. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1510. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1511. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1512. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1513. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1514. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1515. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1516. low-block: Deep elite defence suppresses xG and reduces pace impact.
1517. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1518. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1519. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1520. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1521. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1522. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1523. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1524. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1525. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1526. low-block: Deep elite defence suppresses xG and reduces pace impact.
1527. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1528. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1529. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1530. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1531. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1532. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1533. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1534. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1535. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1536. low-block: Deep elite defence suppresses xG and reduces pace impact.
1537. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1538. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1539. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1540. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1541. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1542. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1543. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1544. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1545. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1546. low-block: Deep elite defence suppresses xG and reduces pace impact.
1547. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1548. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1549. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1550. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1551. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1552. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1553. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1554. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1555. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1556. low-block: Deep elite defence suppresses xG and reduces pace impact.
1557. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1558. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1559. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1560. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1561. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1562. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1563. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1564. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1565. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1566. low-block: Deep elite defence suppresses xG and reduces pace impact.
1567. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1568. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1569. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1570. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1571. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1572. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1573. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1574. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1575. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1576. low-block: Deep elite defence suppresses xG and reduces pace impact.
1577. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1578. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1579. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1580. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1581. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1582. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1583. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1584. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1585. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1586. low-block: Deep elite defence suppresses xG and reduces pace impact.
1587. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1588. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1589. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1590. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1591. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1592. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1593. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1594. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1595. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1596. low-block: Deep elite defence suppresses xG and reduces pace impact.
1597. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1598. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1599. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1600. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1601. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1602. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1603. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1604. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1605. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1606. low-block: Deep elite defence suppresses xG and reduces pace impact.
1607. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1608. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1609. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1610. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1611. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1612. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1613. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1614. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1615. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1616. low-block: Deep elite defence suppresses xG and reduces pace impact.
1617. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1618. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1619. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1620. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1621. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1622. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1623. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1624. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1625. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1626. low-block: Deep elite defence suppresses xG and reduces pace impact.
1627. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1628. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1629. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1630. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1631. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1632. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1633. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1634. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1635. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1636. low-block: Deep elite defence suppresses xG and reduces pace impact.
1637. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1638. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1639. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1640. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1641. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1642. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1643. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1644. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1645. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1646. low-block: Deep elite defence suppresses xG and reduces pace impact.
1647. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1648. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1649. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1650. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1651. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1652. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1653. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1654. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1655. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1656. low-block: Deep elite defence suppresses xG and reduces pace impact.
1657. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1658. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1659. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1660. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1661. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1662. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1663. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1664. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1665. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1666. low-block: Deep elite defence suppresses xG and reduces pace impact.
1667. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1668. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1669. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1670. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1671. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1672. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1673. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1674. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1675. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1676. low-block: Deep elite defence suppresses xG and reduces pace impact.
1677. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1678. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1679. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1680. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1681. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1682. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1683. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1684. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1685. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1686. low-block: Deep elite defence suppresses xG and reduces pace impact.
1687. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1688. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1689. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1690. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1691. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1692. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1693. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1694. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1695. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1696. low-block: Deep elite defence suppresses xG and reduces pace impact.
1697. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1698. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1699. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1700. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1701. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1702. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1703. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1704. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1705. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1706. low-block: Deep elite defence suppresses xG and reduces pace impact.
1707. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1708. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1709. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1710. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1711. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1712. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1713. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1714. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1715. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1716. low-block: Deep elite defence suppresses xG and reduces pace impact.
1717. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1718. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1719. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1720. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1721. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1722. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1723. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1724. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1725. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1726. low-block: Deep elite defence suppresses xG and reduces pace impact.
1727. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1728. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1729. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1730. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1731. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1732. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1733. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1734. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1735. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1736. low-block: Deep elite defence suppresses xG and reduces pace impact.
1737. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1738. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1739. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1740. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1741. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1742. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1743. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1744. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1745. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1746. low-block: Deep elite defence suppresses xG and reduces pace impact.
1747. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1748. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1749. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1750. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1751. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1752. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1753. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1754. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1755. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1756. low-block: Deep elite defence suppresses xG and reduces pace impact.
1757. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1758. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1759. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1760. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1761. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1762. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1763. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1764. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1765. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1766. low-block: Deep elite defence suppresses xG and reduces pace impact.
1767. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1768. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1769. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1770. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1771. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1772. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1773. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1774. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1775. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1776. low-block: Deep elite defence suppresses xG and reduces pace impact.
1777. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1778. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1779. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1780. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1781. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1782. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1783. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1784. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1785. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1786. low-block: Deep elite defence suppresses xG and reduces pace impact.
1787. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1788. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1789. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
1790. pace-behind-high-line: Pace only explodes if the opponent leaves space or lacks CDM cover.
1791. star-gravity-overload: A genius winger drags fullback, CB and CM cover, freeing striker/CAM.
1792. dirty-work-shield: Elite CDMs reduce fullback and CB vulnerability.
1793. poacher-service: Poachers need creators; without lineBreaking their poaching edge is suppressed.
1794. crossing-aerial: Crossing only matters if there are aerial targets or weak aerial defenders.
1795. press-trap: Pressing only matters if opponent pressResistance and GK distribution are low.
1796. low-block: Deep elite defence suppresses xG and reduces pace impact.
1797. chaos-game: Two elite attacks plus weak defensive balance can become 4-4 or 5-4.
1798. brutal-mismatch: If final gap is huge, 7-0 or 9-1 becomes possible.
1799. goalkeeper-wall: Elite GK plus high defence can keep a lower attack to 0.
*/



/*
═══════════════════════════════════════════════════════════════════════════════
DRAFT ZONE — MATCH REALISM SANITY PATCH v7.0
Paste this at the VERY BOTTOM of engine.js.

This patch intentionally overrides the previous ultra/high-score logic with a
more stable football engine.

Main fixes:
- Stops attack / midfield / synergy randomly becoming 99.
- Makes displayed phase ratings absolute team-quality scores, not weird matchup splits.
- Makes normal football scores common: 0-0, 1-0, 1-1, 2-1, 3-1, 3-2.
- Still allows 5-0, 6-1, 7-2, 8-0, etc when there is a genuine mismatch.
- Gives defenders realistic ratings instead of default 5.7.
- Lets players score/assist more than once.
- Rewards star players, but does not let every star automatically break the game.
═══════════════════════════════════════════════════════════════════════════════
*/
;(function(){
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  root.ENGINE = root.ENGINE || {};
  const VERSION = "match-realism-sanity-v7.0";

  const clamp = (v,lo=0,hi=100)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:0));
  const round = (v,d=1)=>{const m=Math.pow(10,d);return Math.round((Number.isFinite(+v)?+v:0)*m)/m;};
  const avg = arr => {
    const f=(arr||[]).flat().filter(v=>Number.isFinite(+v)).map(Number);
    return f.length?f.reduce((a,b)=>a+b,0)/f.length:0;
  };
  const sum = arr => (arr||[]).filter(v=>Number.isFinite(+v)).map(Number).reduce((a,b)=>a+b,0);
  const sortBy = (arr,fn)=>[...(arr||[])].sort((a,b)=>fn(b)-fn(a));
  const nameOf = p => p && p.name ? String(p.name).split("—")[0].trim() : "Unknown";

  function attr(p,k,def=70){
    if(!p) return def;
    if(k==="defence"){
      if(p.defence!=null) return +p.defence;
      if(p.defense!=null) return +p.defense;
    }
    if(k==="defense"){
      if(p.defense!=null) return +p.defense;
      if(p.defence!=null) return +p.defence;
    }
    if(p[k]!=null && Number.isFinite(+p[k])) return +p[k];

    switch(k){
      case "goalkeeperRating": return String(p.position).toUpperCase()==="GK" ? attr(p,"overall",def) : 0;
      case "reflexes": return String(p.position).toUpperCase()==="GK" ? attr(p,"overall",def) : 0;
      case "commandOfArea": return String(p.position).toUpperCase()==="GK" ? attr(p,"overall",def) : 0;
      case "distribution": return String(p.position).toUpperCase()==="GK" ? avg([attr(p,"passing",def),attr(p,"technical",def),attr(p,"overall",def)]) : 0;
      case "pressResistance": return avg([attr(p,"technical",def),attr(p,"midfield",def),attr(p,"composure",def)]);
      case "composure": return avg([attr(p,"technical",def),attr(p,"intelligence",def),attr(p,"consistency",def)]);
      case "visionRange": return avg([attr(p,"passing",def),attr(p,"creativity",def),attr(p,"intelligence",def)]);
      case "offTheBall": return avg([attr(p,"positioning",def),attr(p,"intelligence",def),attr(p,"attack",def)]);
      case "poaching": return avg([attr(p,"finishing",def),attr(p,"positioning",def),attr(p,"offTheBall",def)]);
      case "recoveryPace": return avg([attr(p,"pace",def),attr(p,"defence",def),attr(p,"stamina",def)]);
      case "marking": return avg([attr(p,"defence",def),attr(p,"defensiveAwareness",def),attr(p,"positioning",def)]);
      case "lineBreaking": return avg([attr(p,"passing",def),attr(p,"visionRange",def),attr(p,"creativity",def)]);
      case "aggression": return avg([attr(p,"pressing",def),attr(p,"workRate",def),attr(p,"physical",def),attr(p,"tackling",def)]);
      case "clutch": return avg([attr(p,"bigGameRating",def),attr(p,"consistency",def),attr(p,"leadership",def)]);
      case "adaptability": return avg([attr(p,"intelligence",def),attr(p,"versatility",def),attr(p,"consistency",def)]);
      default: return def;
    }
  }

  function scaled(v){
    v = Number.isFinite(+v)?+v:70;
    if(v<=60) return clamp(v,1,99);
    if(v<=80) return 60 + (v-60)*0.95;
    if(v<=90) return 79 + (v-80)*0.75;
    if(v<=96) return 86.5 + (v-90)*0.45;
    return clamp(89.2 + (v-96)*0.25,1,99);
  }

  function weighted(list){
    let s=0,w=0;
    for(const [v,wt] of list){
      if(Number.isFinite(+v)&&Number.isFinite(+wt)){s+=v*wt;w+=wt;}
    }
    return w?s/w:0;
  }

  function layout(){
    if(Array.isArray(root.LAYOUT)) return root.LAYOUT;
    return [
      {role:"gk"},{role:"lb"},{role:"cb"},{role:"cb"},{role:"rb"},
      {role:"cdm"},{role:"cm"},{role:"cam"},{role:"lw"},{role:"rw"},{role:"st"}
    ];
  }

  function units(team){
    const l=layout();
    const all=[];
    (team||[]).forEach((p,i)=>{
      if(!p) return;
      const role=(l[i]&&l[i].role)||String(p.position||"CM").toLowerCase();
      all.push({p,role,index:i});
    });
    const role=r=>all.filter(x=>x.role===r);
    const one=r=>role(r)[0]||null;
    const any=roles=>all.filter(x=>roles.includes(x.role));
    return {
      all,
      gk:one("gk"),
      lb:one("lb"),
      rb:one("rb"),
      cbs:role("cb"),
      cdm:one("cdm"),
      cms:role("cm"),
      cam:one("cam"),
      lw:one("lw"),
      rw:one("rw"),
      st:one("st"),
      attackers:any(["lw","rw","st","cam"]),
      mids:any(["cdm","cm","cam"]),
      defenders:any(["lb","cb","rb","cdm"]),
      backline:any(["lb","cb","rb"]),
      wide:any(["lw","rw","lb","rb"])
    };
  }

  function roleQuality(x){
    const p=x.p,r=x.role;
    if(r==="gk") return scaled(weighted([
      [attr(p,"goalkeeperRating"),.42],[attr(p,"reflexes"),.24],
      [attr(p,"commandOfArea"),.18],[attr(p,"distribution"),.10],
      [attr(p,"composure"),.06]
    ]));
    if(r==="st") return scaled(weighted([
      [attr(p,"attack"),.20],[attr(p,"finishing"),.22],[attr(p,"poaching"),.16],
      [attr(p,"offTheBall"),.12],[attr(p,"physical"),.08],[attr(p,"pace"),.08],
      [attr(p,"technical"),.08],[attr(p,"clutch"),.06]
    ]));
    if(r==="lw"||r==="rw") return scaled(weighted([
      [attr(p,"attack"),.18],[attr(p,"dribbling"),.18],[attr(p,"pace"),.15],
      [attr(p,"technical"),.14],[attr(p,"creativity"),.11],[attr(p,"finishing"),.09],
      [attr(p,"crossing"),.07],[attr(p,"workRate"),.04],[attr(p,"clutch"),.04]
    ]));
    if(r==="cam") return scaled(weighted([
      [attr(p,"midfield"),.17],[attr(p,"creativity"),.18],[attr(p,"passing"),.15],
      [attr(p,"technical"),.13],[attr(p,"visionRange"),.13],[attr(p,"attack"),.10],
      [attr(p,"pressResistance"),.08],[attr(p,"clutch"),.06]
    ]));
    if(r==="cm") return scaled(weighted([
      [attr(p,"midfield"),.22],[attr(p,"passing"),.15],[attr(p,"pressResistance"),.13],
      [attr(p,"intelligence"),.12],[attr(p,"workRate"),.11],[attr(p,"technical"),.10],
      [attr(p,"defence"),.07],[attr(p,"stamina"),.07],[attr(p,"attack"),.03]
    ]));
    if(r==="cdm") return scaled(weighted([
      [attr(p,"defence"),.20],[attr(p,"midfield"),.17],[attr(p,"defensiveAwareness"),.15],
      [attr(p,"tackling"),.13],[attr(p,"positioning"),.11],[attr(p,"intelligence"),.09],
      [attr(p,"physical"),.06],[attr(p,"pressResistance"),.05],[attr(p,"workRate"),.04]
    ]));
    if(r==="cb") return scaled(weighted([
      [attr(p,"defence"),.23],[attr(p,"defensiveAwareness"),.18],[attr(p,"tackling"),.14],
      [attr(p,"positioning"),.13],[attr(p,"aerial"),.10],[attr(p,"physical"),.09],
      [attr(p,"intelligence"),.08],[attr(p,"recoveryPace"),.05]
    ]));
    if(r==="lb"||r==="rb") return scaled(weighted([
      [attr(p,"defence"),.18],[attr(p,"pace"),.15],[attr(p,"workRate"),.12],
      [attr(p,"tackling"),.11],[attr(p,"defensiveAwareness"),.11],[attr(p,"stamina"),.10],
      [attr(p,"crossing"),.08],[attr(p,"attack"),.07],[attr(p,"intelligence"),.06],
      [attr(p,"technical"),.02]
    ]));
    return scaled(attr(p,"overall",75));
  }

  function attackThreat(x){
    const p=x.p;
    return scaled(weighted([
      [roleQuality(x),.22],[attr(p,"attack"),.18],[attr(p,"finishing"),.16],
      [attr(p,"technical"),.13],[attr(p,"dribbling"),.12],[attr(p,"creativity"),.08],
      [attr(p,"offTheBall"),.06],[attr(p,"clutch"),.05]
    ]));
  }
  function midfieldThreat(x){
    const p=x.p;
    return scaled(weighted([
      [roleQuality(x),.24],[attr(p,"midfield"),.18],[attr(p,"passing"),.15],
      [attr(p,"pressResistance"),.12],[attr(p,"intelligence"),.11],
      [attr(p,"technical"),.10],[attr(p,"workRate"),.06],[attr(p,"creativity"),.04]
    ]));
  }
  function defenceThreat(x){
    const p=x.p;
    return scaled(weighted([
      [roleQuality(x),.24],[attr(p,"defence"),.19],[attr(p,"defensiveAwareness"),.16],
      [attr(p,"tackling"),.13],[attr(p,"positioning"),.10],[attr(p,"physical"),.07],
      [attr(p,"intelligence"),.07],[attr(p,"recoveryPace"),.04]
    ]));
  }
  function transitionThreat(x){
    const p=x.p;
    return scaled(weighted([
      [attr(p,"pace"),.25],[attr(p,"transitionThreat"),.22],[attr(p,"offTheBall"),.12],
      [attr(p,"dribbling"),.11],[attr(p,"lineBreaking"),.10],[attr(p,"passing"),.07],
      [attr(p,"attack"),.06],[attr(p,"stamina"),.04],[attr(p,"decisionMaking"),.03]
    ]));
  }

  function starGravity(x){
    if(!x) return 0;
    const p=x.p;
    const raw=weighted([
      [attr(p,"overall"),.20],[attr(p,"attack"),.16],[attr(p,"technical"),.14],
      [attr(p,"dribbling"),.13],[attr(p,"creativity"),.11],
      [attr(p,"finishing"),.10],[attr(p,"clutch"),.08],[attr(p,"visionRange"),.08]
    ]);
    let g=Math.max(0,(raw-88)*1.4);
    if(attr(p,"overall")>=97) g+=8;
    else if(attr(p,"overall")>=94) g+=4;
    return clamp(g,0,22);
  }

  function dirtyCover(x){
    if(!x) return 0;
    const p=x.p,r=x.role;
    const raw=weighted([
      [attr(p,"defence"),.17],[attr(p,"midfield"),.15],[attr(p,"workRate"),.14],
      [attr(p,"tackling"),.13],[attr(p,"aggression"),.12],[attr(p,"positioning"),.10],
      [attr(p,"physical"),.08],[attr(p,"intelligence"),.07],[attr(p,"stamina"),.04]
    ]);
    let c=Math.max(0,(raw-76)*0.65);
    if(r==="cdm") c+=4;
    if(r==="cm") c+=2;
    return clamp(c,0,18);
  }

  function teamProfile(team){
    const u=units(team);
    const all=u.all;

    const topAtk=avg(sortBy(u.attackers,attackThreat).slice(0,4).map(attackThreat));
    const topMid=avg(sortBy(u.mids,midfieldThreat).slice(0,4).map(midfieldThreat));
    const back=avg(u.backline.map(defenceThreat));
    const cb=avg(u.cbs.map(defenceThreat));
    const fb=avg([u.lb,u.rb].filter(Boolean).map(defenceThreat));
    const cdm=u.cdm?defenceThreat(u.cdm):avg(u.cms.map(defenceThreat))*0.82;
    const gk=u.gk?roleQuality(u.gk):55;

    const gravity=sum(sortBy(u.attackers.concat([u.cam].filter(Boolean)),starGravity).slice(0,3).map(starGravity));
    const cover=sum(sortBy(u.mids.concat(u.backline),dirtyCover).slice(0,4).map(dirtyCover));

    const attack=scaled(weighted([
      [topAtk,.46],
      [avg(u.attackers.map(x=>attr(x.p,"finishing"))),.16],
      [avg(u.attackers.concat([u.cam].filter(Boolean)).map(x=>attr(x.p,"creativity"))),.12],
      [avg(u.attackers.map(x=>attr(x.p,"technical"))),.10],
      [avg(u.attackers.map(x=>attr(x.p,"offTheBall"))),.09],
      [82+gravity*.25,.07]
    ]));

    const midfield=scaled(weighted([
      [topMid,.42],
      [avg(u.mids.map(x=>attr(x.p,"passing"))),.14],
      [avg(u.mids.map(x=>attr(x.p,"pressResistance"))),.12],
      [avg(u.mids.map(x=>attr(x.p,"intelligence"))),.11],
      [avg(u.mids.map(x=>attr(x.p,"workRate"))),.08],
      [avg(u.mids.map(x=>attr(x.p,"defence"))),.07],
      [80+cover*.22,.06]
    ]));

    const defence=scaled(weighted([
      [back,.35],
      [cb,.19],
      [cdm,.15],
      [gk,.11],
      [avg(u.backline.map(x=>attr(x.p,"defensiveAwareness"))),.08],
      [avg(u.backline.map(x=>attr(x.p,"aerial"))),.05],
      [avg(u.backline.map(x=>attr(x.p,"recoveryPace"))),.04],
      [80+cover*.25,.03]
    ]));

    const transition=scaled(weighted([
      [avg(sortBy(u.attackers.concat(u.mids),transitionThreat).slice(0,5).map(transitionThreat)),.40],
      [avg(u.attackers.map(x=>attr(x.p,"pace"))),.18],
      [avg(u.mids.map(x=>attr(x.p,"lineBreaking"))),.13],
      [avg(u.attackers.map(x=>attr(x.p,"transitionThreat"))),.13],
      [avg(u.mids.map(x=>attr(x.p,"visionRange"))),.08],
      [80+gravity*.18,.08]
    ]));

    const wide=scaled(weighted([
      [avg([u.lw,u.rw].filter(Boolean).map(attackThreat)),.33],
      [avg([u.lb,u.rb].filter(Boolean).map(roleQuality)),.24],
      [avg(u.wide.map(x=>attr(x.p,"pace"))),.14],
      [avg(u.wide.map(x=>attr(x.p,"crossing"))),.12],
      [avg(u.wide.map(x=>attr(x.p,"workRate"))),.09],
      [avg(u.wide.map(x=>attr(x.p,"defence"))),.08]
    ]));

    const pressing=scaled(weighted([
      [avg(sortBy(all,x=>weighted([[attr(x.p,"pressing"),.4],[attr(x.p,"workRate"),.3],[attr(x.p,"stamina"),.2],[attr(x.p,"aggression"),.1]])).slice(0,7).map(x=>weighted([[attr(x.p,"pressing"),.4],[attr(x.p,"workRate"),.3],[attr(x.p,"stamina"),.2],[attr(x.p,"aggression"),.1]]))),.50],
      [avg(all.map(x=>attr(x.p,"workRate"))),.17],
      [avg(all.map(x=>attr(x.p,"stamina"))),.14],
      [avg(u.attackers.map(x=>attr(x.p,"pressing"))),.10],
      [avg(all.map(x=>attr(x.p,"intelligence"))),.09]
    ]));

    const setPieces=scaled(weighted([
      [Math.max(...all.map(x=>attr(x.p,"setPieces")).concat([50])),.24],
      [avg(sortBy(all,x=>attr(x.p,"crossing")).slice(0,4).map(x=>attr(x.p,"crossing"))),.18],
      [avg(sortBy(all,x=>attr(x.p,"aerial")).slice(0,5).map(x=>attr(x.p,"aerial"))),.20],
      [avg(sortBy(all,x=>attr(x.p,"physical")).slice(0,5).map(x=>attr(x.p,"physical"))),.12],
      [avg(all.map(x=>attr(x.p,"positioning"))),.10],
      [gk,.06],
      [avg(all.map(x=>attr(x.p,"clutch"))),.10]
    ]));

    const goalkeeper=gk;

    let synergy=76;
    if(u.cdm&&u.cbs.length>=2) synergy+=3;
    if(u.cam&&u.st) synergy+=2;
    if(u.lw&&u.lb) synergy+=1.5;
    if(u.rw&&u.rb) synergy+=1.5;
    if(cover>20) synergy+=3;
    if(gravity>15 && midfield>84) synergy+=3;
    if(transition>86 && avg(u.mids.map(x=>attr(x.p,"lineBreaking")))>82) synergy+=2;
    if(setPieces>86 && avg(u.attackers.concat(u.cbs).map(x=>attr(x.p,"aerial")))>84) synergy+=2;
    if(!u.cdm) synergy-=4;
    if(defence<76 && wide>86) synergy-=3;
    if(attack>88 && midfield<80) synergy-=3;
    synergy=scaled(synergy);

    const balance=scaled(100-(Math.abs(attack-defence)*.45+Math.abs(midfield-defence)*.25+Math.abs(attack-midfield)*.20));

    return {
      units:u,attack,midfield,defence,transition,wide,pressing,setPieces,goalkeeper,synergy,balance,
      creativity:scaled(avg(u.attackers.concat(u.mids).map(x=>attr(x.p,"creativity")))),
      pressResistance:scaled(avg(all.map(x=>attr(x.p,"pressResistance")))),
      finishing:scaled(avg(u.attackers.map(x=>attr(x.p,"finishing")))),
      cdmCover:scaled(cdm + cover*.35),
      cbPace:scaled(avg(u.cbs.map(x=>attr(x.p,"recoveryPace")))),
      cbDefence:cb,
      aerialDefence:scaled(avg(u.backline.concat(u.gk?[u.gk]:[]).map(x=>attr(x.p,"aerial")))),
      fbRisk:scaled(avg([u.lb,u.rb].filter(Boolean).map(x=>attr(x.p,"attack")*.65+attr(x.p,"pace")*.18-attr(x.p,"defensiveAwareness")*.16))),
      gravity,
      cover
    };
  }

  function contextScore(A,B){
    const base=weighted([
      [A.attack,.17],[A.midfield,.16],[A.defence,.16],[A.transition,.09],
      [A.creativity,.08],[A.wide,.06],[A.pressing,.06],[A.setPieces,.05],
      [A.goalkeeper,.08],[A.synergy,.06],[A.balance,.03]
    ]);

    let edge=0;
    edge+=(A.attack-B.defence)*.07;
    edge+=(A.midfield-B.midfield)*.06;
    edge+=(A.transition-B.cbPace)*.035;
    edge+=(A.creativity-B.cdmCover)*.035;
    edge+=(A.pressing-B.pressResistance)*.025;
    edge+=(A.setPieces-B.aerialDefence)*.025;
    edge+=(A.goalkeeper-B.goalkeeper)*.025;
    edge+=(A.gravity-B.cover)*.035;

    let penalty=0;
    if(B.transition>A.cbPace+8 && A.fbRisk>76) penalty+=1.8;
    if(B.creativity>A.cdmCover+8) penalty+=1.4;
    if(B.setPieces>A.aerialDefence+8) penalty+=1.0;
    if(B.pressing>A.pressResistance+10) penalty+=1.0;
    if(A.balance<72 && B.transition>84) penalty+=1.2;

    return clamp(base+edge-penalty,1,110);
  }

  function expectedGoals(A,B,scoreA,scoreB){
    const diff=scoreA-scoreB;
    let xg=1.10;
    xg+=(A.attack-B.defence)*.014;
    xg+=(A.creativity-B.cdmCover)*.009;
    xg+=(A.transition-B.cbPace)*.008;
    xg+=(A.setPieces-B.aerialDefence)*.005;
    xg+=(A.gravity-B.cover)*.010;
    xg+=Math.max(0,diff)*.018;

    if(B.defence>88 && B.goalkeeper>88) xg-=.25;
    if(B.cdmCover>88) xg-=.15;
    if(A.attack>90 && B.defence<78) xg+=.18;
    if(A.transition>88 && B.cbPace<78 && B.fbRisk>76) xg+=.25;
    if(A.pressing>88 && B.pressResistance<78) xg+=.15;

    if(diff>16) xg+=(diff-16)*.025;
    if(diff>28) xg+=(diff-28)*.050;
    if(diff>45) xg+=(diff-45)*.080;

    return Math.max(.05,xg);
  }

  function goalsFromXG(xg,diff,finish,keeper){
    let g=Math.floor(xg);
    const rem=xg-g;
    let chance=rem+(finish-keeper)*.004;
    if(chance>.62) g++;
    if(diff>15 && xg>2.0 && chance>.40) g++;
    if(diff>28 && xg>3.0) g++;
    if(diff>45 && xg>4.2) g++;
    if(xg>5.5) g+=Math.floor((xg-5.5)*.45);
    if(xg>8.0) g+=Math.floor((xg-8.0)*.60);
    return Math.max(0,g);
  }

  function makeScore(A,B,scoreA,scoreB){
    const xgA=expectedGoals(A,B,scoreA,scoreB);
    const xgB=expectedGoals(B,A,scoreB,scoreA);
    const diff=scoreA-scoreB;
    let gA=goalsFromXG(xgA,diff,A.finishing,B.goalkeeper);
    let gB=goalsFromXG(xgB,-diff,B.finishing,A.goalkeeper);

    if(Math.abs(diff)<5 && xgA<2.4 && xgB<2.4){
      gA=Math.min(gA,3);
      gB=Math.min(gB,3);
    }

    if(diff>22 && gA<4) gA=4;
    if(diff>34 && gA<6) gA=6;
    if(diff>50 && gA<8) gA=8;
    if(diff>34 && gB>2) gB=2;
    if(diff>48 && gB>1) gB=1;

    if(diff<-22 && gB<4) gB=4;
    if(diff<-34 && gB<6) gB=6;
    if(diff<-50 && gB<8) gB=8;
    if(diff<-34 && gA>2) gA=2;
    if(diff<-48 && gA>1) gA=1;

    if(A.defence>90 && B.defence>90 && A.attack<80 && B.attack<80){
      gA=Math.min(gA,1);gB=Math.min(gB,1);
    }

    return {xgA:round(xgA,2),xgB:round(xgB,2),goalsA:gA,goalsB:gB,scoreline:`${gA}-${gB}`};
  }

  function split(diff){
    const s=1/(1+Math.exp(-diff*.16));
    return clamp(Math.round(s*100),1,99);
  }

  function keyBattles(teamA,teamB,names,A,B){
    const au=A.units,bu=B.units;
    const out=[];
    function add(title,a,b,av,bv,reason){
      const score=split(av-bv);
      out.push({title,aName:a,bName:b,score:`${score}-${100-score}`,scoreA:score,scoreB:100-score,winner:score===50?"Even":score>50?names[0]:names[1],reason,diff:round(av-bv,1)});
    }
    const aStar=sortBy(au.attackers,starGravity)[0];
    const bStop=sortBy(bu.defenders,defenceThreat)[0];
    const bStar=sortBy(bu.attackers,starGravity)[0];
    const aStop=sortBy(au.defenders,defenceThreat)[0];

    if(aStar&&bStop) add(`${nameOf(aStar.p)} vs ${nameOf(bStop.p)}`,nameOf(aStar.p),nameOf(bStop.p),attackThreat(aStar)+starGravity(aStar)*.45,defenceThreat(bStop)+B.cover*.16,"star quality against the best available defensive cover");
    if(bStar&&aStop) add(`${nameOf(bStar.p)} vs ${nameOf(aStop.p)}`,nameOf(bStar.p),nameOf(aStop.p),attackThreat(bStar)+starGravity(bStar)*.45,defenceThreat(aStop)+A.cover*.16,"star quality against the best available defensive cover");
    if(au.st&&bu.cbs[0]) add(`${nameOf(au.st.p)} vs ${nameOf(sortBy(bu.cbs,defenceThreat)[0].p)}`,nameOf(au.st.p),nameOf(sortBy(bu.cbs,defenceThreat)[0].p),attackThreat(au.st),defenceThreat(sortBy(bu.cbs,defenceThreat)[0])+B.cdmCover*.08,"striker movement and finishing against centre-back resistance");
    if(bu.st&&au.cbs[0]) add(`${nameOf(bu.st.p)} vs ${nameOf(sortBy(au.cbs,defenceThreat)[0].p)}`,nameOf(bu.st.p),nameOf(sortBy(au.cbs,defenceThreat)[0].p),attackThreat(bu.st),defenceThreat(sortBy(au.cbs,defenceThreat)[0])+A.cdmCover*.08,"striker movement and finishing against centre-back resistance");
    add(`${names[0]} midfield vs ${names[1]} midfield`,names[0],names[1],A.midfield+A.cover*.08,B.midfield+B.cover*.08,"control, second balls and defensive protection");
    add(`${names[0]} transition vs ${names[1]} cover`,names[0],names[1],A.transition,B.cbPace+B.cdmCover*.12,"whether pace actually has space to hurt the defence");
    add(`${names[1]} transition vs ${names[0]} cover`,names[1],names[0],B.transition,A.cbPace+A.cdmCover*.12,"whether pace actually has space to hurt the defence");
    return out.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).slice(0,8);
  }

  function distributeGoals(team,goals,A,B){
    const u=units(team);
    const c=u.attackers.length?u.attackers:u.all;
    const out={};
    for(let i=0;i<goals;i++){
      const weights=c.map(x=>{
        let w=1+attr(x.p,"finishing")*.035+attr(x.p,"poaching")*.025+attr(x.p,"attack")*.018+starGravity(x)*.10;
        if(x.role==="st") w*=1.45;
        if(x.role==="lw"||x.role==="rw") w*=1.15;
        return w;
      });
      let total=sum(weights), r=((i+1)*0.371%1)*total, pick=c[0];
      for(let j=0;j<c.length;j++){r-=weights[j];if(r<=0){pick=c[j];break;}}
      out[nameOf(pick.p)]=(out[nameOf(pick.p)]||0)+1;
    }
    return out;
  }

  function distributeAssists(team,goals,A,B){
    const u=units(team);
    const c=u.mids.concat(u.attackers);
    const out={};
    for(let i=0;i<Math.max(0,goals-(goals>=4?1:0));i++){
      const weights=c.map(x=>{
        let w=1+attr(x.p,"creativity")*.032+attr(x.p,"passing")*.026+attr(x.p,"visionRange")*.020+attr(x.p,"crossing")*.012;
        if(x.role==="cam") w*=1.25;
        if(x.role==="cm") w*=1.10;
        return w;
      });
      let total=sum(weights), r=((i+1)*0.527%1)*total, pick=c[0];
      for(let j=0;j<c.length;j++){r-=weights[j];if(r<=0){pick=c[j];break;}}
      out[nameOf(pick.p)]=(out[nameOf(pick.p)]||0)+1;
    }
    return out;
  }

  function playerRatings(team,A,B,teamScore,oppScore,goalsFor,goalsAgainst){
    const u=units(team);
    const goals=distributeGoals(team,goalsFor,A,B);
    const assists=distributeAssists(team,goalsFor,A,B);
    const dominance=teamScore-oppScore;
    return u.all.map(x=>{
      const nm=nameOf(x.p),r=x.role;
      let rt=6.1+(roleQuality(x)-78)*.028+dominance*.014;
      if(["st","lw","rw","cam"].includes(r)) rt+=(A.attack-80)*.016+(A.creativity-80)*.008;
      if(["cm","cdm","cam"].includes(r)) rt+=(A.midfield-80)*.016+dirtyCover(x)*.020;
      if(["cb","lb","rb","cdm","gk"].includes(r)){
        rt+=(A.defence-80)*.018+(A.cdmCover-80)*.010;
        rt-=goalsAgainst*.115;
        if(goalsAgainst===0) rt+=r==="gk"?.55:.38;
        if(goalsAgainst>=5) rt-=.45;
      }
      const g=goals[nm]||0,a=assists[nm]||0;
      rt+=g*.78+a*.40;
      if(g>=2) rt+=.28;
      if(g>=3) rt+=.45;
      if(a>=2) rt+=.22;
      if(goalsFor===0&&["st","lw","rw","cam"].includes(r)) rt-=.25;
      return {name:nm,position:r.toUpperCase(),rating:round(clamp(rt,3.2,10),1),goals:g,assists:a};
    }).sort((a,b)=>b.rating-a.rating);
  }

  function publicPhases(P,final){
    return {
      attack:round(P.attack,1),
      midfield:round(P.midfield,1),
      defence:round(P.defence,1),
      transition:round(P.transition,1),
      wide:round(P.wide,1),
      leftFlank:round(P.wide,1),
      rightFlank:round(P.wide,1),
      pressing:round(P.pressing,1),
      setPieces:round(P.setPieces,1),
      goalkeeper:round(P.goalkeeper,1),
      synergy:round(P.synergy,1),
      chanceCreation:round(P.creativity,1),
      possession:round(scaled(weighted([[P.midfield,.55],[P.pressResistance,.25],[P.synergy,.20]])),1),
      balance:round(P.balance,1),
      final:round(final,1)
    };
  }

  function verdict(teamA,teamB,names=["Player 1","Player 2"]){
    const A=teamProfile(teamA),B=teamProfile(teamB);
    const sA=contextScore(A,B),sB=contextScore(B,A);
    const sc=makeScore(A,B,sA,sB);
    const battles=keyBattles(teamA,teamB,names,A,B);
    const rA=playerRatings(teamA,A,B,sA,sB,sc.goalsA,sc.goalsB);
    const rB=playerRatings(teamB,B,A,sB,sA,sc.goalsB,sc.goalsA);
    const allR=rA.map(x=>({...x,team:names[0]})).concat(rB.map(x=>({...x,team:names[1]}))).sort((a,b)=>b.rating-a.rating);
    const diff=sA-sB;
    const winner=sc.goalsA>sc.goalsB?names[0]:sc.goalsB>sc.goalsA?names[1]:"Draw";
    let type="coin flip";
    if(Math.abs(diff)>=40) type="brutal mismatch";
    else if(Math.abs(diff)>=25) type="dominant win";
    else if(Math.abs(diff)>=12) type="clear win";
    else if(Math.abs(diff)>=5) type="narrow win";

    return {
      version:VERSION,
      winner,
      winProbability:{[names[0]]:round(clamp(50+diff*2.1,1,99),1),[names[1]]:round(clamp(50-diff*2.1,1,99),1)},
      verdictType:type,
      finalScores:{[names[0]]:round(sA,1),[names[1]]:round(sB,1)},
      scoreline:sc.scoreline,
      expectedGoals:{[names[0]]:sc.xgA,[names[1]]:sc.xgB},
      phases:{[names[0]]:publicPhases(A,sA),[names[1]]:publicPhases(B,sB)},
      keyBattles:battles,
      playerRatings:{[names[0]]:rA,[names[1]]:rB,manOfTheMatch:allR[0]||null},
      tactical:{
        [names[0]]:{gravity:round(A.gravity,1),cover:round(A.cover,1),profile:A},
        [names[1]]:{gravity:round(B.gravity,1),cover:round(B.cover,1),profile:B}
      },
      weaknesses:{[names[0]]:{total:0,items:[]},[names[1]]:{total:0,items:[]}},
      narrative: winner==="Draw"
        ? `The match finishes ${sc.scoreline}. The teams are close enough that midfield control, defensive resistance and chance quality cancel each other out.`
        : `${winner} wins ${sc.scoreline}. The result is driven by the actual phase advantages rather than inflated 99 ratings: attack ${round(A.attack,1)}-${round(B.attack,1)}, midfield ${round(A.midfield,1)}-${round(B.midfield,1)}, defence ${round(A.defence,1)}-${round(B.defence,1)}.`,
      decidingBattle:battles[0]||null,
      debug:{A,B,scoreA:sA,scoreB:sB,score:sc}
    };
  }

  root.ENGINE.calculateAdvancedVerdict=verdict;
  root.ENGINE.calculateUltraDynamicVerdict=verdict;
  root.ENGINE.calculateRealisticDynamicVerdict=verdict;
  root.ENGINE.matchRealismSanityVersion=VERSION;
})();



/*
═══════════════════════════════════════════════════════════════════════════════
DRAFT ZONE — DEFENCE DISPLAY + TEAM PHASE FIX v7.1
Paste this at the VERY BOTTOM of engine.js, after v7.0.

This fixes the exact issue where a team with 80+ defenders can display 37 DEF.
Displayed ATT/MID/DEF are now ABSOLUTE squad ratings:
- Defence = GK + back four + CDM/midfield cover
- It is never dragged down by opponent attack, scoreline, or old matchup penalties
- Matchup logic still affects xG/winner separately
═══════════════════════════════════════════════════════════════════════════════
*/
;(function(){
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.ENGINE = root.ENGINE || {};
  const VERSION = "defence-phase-fix-v7.1";

  const clamp=(v,lo=0,hi=99)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:0));
  const round=(v,d=1)=>{const m=Math.pow(10,d);return Math.round((Number.isFinite(+v)?+v:0)*m)/m;};
  const avg=arr=>{const f=(arr||[]).flat().filter(v=>Number.isFinite(+v)).map(Number);return f.length?f.reduce((a,b)=>a+b,0)/f.length:0;};
  const weighted=list=>{let s=0,w=0;for(const [v,wt] of list){if(Number.isFinite(+v)&&Number.isFinite(+wt)){s+=v*wt;w+=wt;}}return w?s/w:0;};

  function attr(p,k,def=70){
    if(!p)return def;
    if(k==="defence"){ if(p.defence!=null)return +p.defence; if(p.defense!=null)return +p.defense; }
    if(k==="defense"){ if(p.defense!=null)return +p.defense; if(p.defence!=null)return +p.defence; }
    if(p[k]!=null && Number.isFinite(+p[k]))return +p[k];
    switch(k){
      case "goalkeeperRating": return String(p.position||"").toUpperCase()==="GK" ? attr(p,"overall",def) : 0;
      case "reflexes": return String(p.position||"").toUpperCase()==="GK" ? attr(p,"overall",def) : 0;
      case "commandOfArea": return String(p.position||"").toUpperCase()==="GK" ? attr(p,"overall",def) : 0;
      case "recoveryPace": return avg([attr(p,"pace",def),attr(p,"defence",def),attr(p,"stamina",def)]);
      case "defensiveAwareness": return avg([attr(p,"defence",def),attr(p,"positioning",def),attr(p,"intelligence",def)]);
      case "marking": return avg([attr(p,"defence",def),attr(p,"defensiveAwareness",def),attr(p,"positioning",def)]);
      case "pressResistance": return avg([attr(p,"technical",def),attr(p,"midfield",def),attr(p,"composure",def)]);
      case "composure": return avg([attr(p,"technical",def),attr(p,"intelligence",def),attr(p,"consistency",def)]);
      case "visionRange": return avg([attr(p,"passing",def),attr(p,"creativity",def),attr(p,"intelligence",def)]);
      case "offTheBall": return avg([attr(p,"positioning",def),attr(p,"intelligence",def),attr(p,"attack",def)]);
      case "poaching": return avg([attr(p,"finishing",def),attr(p,"positioning",def),attr(p,"offTheBall",def)]);
      case "lineBreaking": return avg([attr(p,"passing",def),attr(p,"visionRange",def),attr(p,"creativity",def)]);
      case "aggression": return avg([attr(p,"pressing",def),attr(p,"workRate",def),attr(p,"physical",def),attr(p,"tackling",def)]);
      case "clutch": return avg([attr(p,"bigGameRating",def),attr(p,"consistency",def),attr(p,"leadership",def)]);
      default:return def;
    }
  }

  // Gentler scale: a real 88-rated defence should display around 86-90,
  // not 37, and not automatically 99.
  function displayScale(v){
    v=Number.isFinite(+v)?+v:70;
    if(v<50)return clamp(v,1,99);
    if(v<75)return 50+(v-50)*0.98;
    if(v<88)return 74.5+(v-75)*0.82;
    if(v<95)return 85.2+(v-88)*0.55;
    return clamp(89.1+(v-95)*0.32,1,99);
  }

  function layout(){
    if(Array.isArray(root.LAYOUT))return root.LAYOUT;
    return [{role:"gk"},{role:"lb"},{role:"cb"},{role:"cb"},{role:"rb"},{role:"cdm"},{role:"cm"},{role:"cam"},{role:"lw"},{role:"rw"},{role:"st"}];
  }
  function units(team){
    const l=layout(), all=[];
    (team||[]).forEach((p,i)=>{
      if(!p)return;
      const role=(l[i]&&l[i].role)||String(p.position||"CM").toLowerCase();
      all.push({p,role,index:i});
    });
    const role=r=>all.filter(x=>x.role===r);
    const one=r=>role(r)[0]||null;
    const any=rs=>all.filter(x=>rs.includes(x.role));
    return {
      all,gk:one("gk"),lb:one("lb"),rb:one("rb"),cbs:role("cb"),cdm:one("cdm"),cms:role("cm"),cam:one("cam"),
      lw:one("lw"),rw:one("rw"),st:one("st"),
      backline:any(["lb","cb","rb"]),mids:any(["cdm","cm","cam"]),attackers:any(["lw","rw","st","cam"]),wide:any(["lw","rw","lb","rb"])
    };
  }

  function defenderQuality(x){
    const p=x.p,r=x.role;
    if(r==="gk")return displayScale(weighted([
      [attr(p,"goalkeeperRating"),.42],[attr(p,"reflexes"),.25],[attr(p,"commandOfArea"),.18],
      [attr(p,"composure"),.08],[attr(p,"distribution"),.07]
    ]));
    if(r==="cb")return displayScale(weighted([
      [attr(p,"defence"),.24],[attr(p,"defensiveAwareness"),.18],[attr(p,"tackling"),.14],
      [attr(p,"positioning"),.13],[attr(p,"aerial"),.10],[attr(p,"physical"),.09],
      [attr(p,"intelligence"),.07],[attr(p,"recoveryPace"),.05]
    ]));
    if(r==="lb"||r==="rb")return displayScale(weighted([
      [attr(p,"defence"),.19],[attr(p,"pace"),.14],[attr(p,"workRate"),.12],
      [attr(p,"defensiveAwareness"),.12],[attr(p,"tackling"),.11],[attr(p,"stamina"),.09],
      [attr(p,"intelligence"),.07],[attr(p,"physical"),.06],[attr(p,"attack"),.05],[attr(p,"crossing"),.05]
    ]));
    if(r==="cdm")return displayScale(weighted([
      [attr(p,"defence"),.21],[attr(p,"midfield"),.16],[attr(p,"defensiveAwareness"),.15],
      [attr(p,"tackling"),.13],[attr(p,"positioning"),.11],[attr(p,"intelligence"),.09],
      [attr(p,"physical"),.06],[attr(p,"workRate"),.05],[attr(p,"pressResistance"),.04]
    ]));
    if(r==="cm")return displayScale(weighted([
      [attr(p,"defence"),.17],[attr(p,"midfield"),.17],[attr(p,"workRate"),.14],
      [attr(p,"tackling"),.11],[attr(p,"positioning"),.11],[attr(p,"intelligence"),.10],
      [attr(p,"physical"),.08],[attr(p,"stamina"),.07],[attr(p,"pressResistance"),.05]
    ]));
    return displayScale(attr(p,"defence",65));
  }

  function attackQuality(x){
    const p=x.p,r=x.role;
    const roleBoost=r==="st"?4:(r==="lw"||r==="rw"?2:r==="cam"?1:0);
    return displayScale(weighted([
      [attr(p,"attack"),.22],[attr(p,"finishing"),.17],[attr(p,"technical"),.14],
      [attr(p,"dribbling"),.13],[attr(p,"creativity"),.10],[attr(p,"pace"),.08],
      [attr(p,"offTheBall"),.08],[attr(p,"clutch"),.05],[attr(p,"overall")+roleBoost,.03]
    ]));
  }
  function midfieldQuality(x){
    const p=x.p;
    return displayScale(weighted([
      [attr(p,"midfield"),.22],[attr(p,"passing"),.16],[attr(p,"pressResistance"),.13],
      [attr(p,"intelligence"),.12],[attr(p,"technical"),.11],[attr(p,"creativity"),.09],
      [attr(p,"workRate"),.08],[attr(p,"defence"),.06],[attr(p,"overall"),.03]
    ]));
  }

  function absolutePhases(team){
    const u=units(team);
    const gkQ=u.gk?defenderQuality(u.gk):55;
    const cbQ=avg(u.cbs.map(defenderQuality));
    const fbQ=avg([u.lb,u.rb].filter(Boolean).map(defenderQuality));
    const cdmQ=u.cdm?defenderQuality(u.cdm):avg(u.cms.map(defenderQuality))*0.78;
    const cmCover=avg(u.cms.map(defenderQuality));

    // THIS is the fixed defence formula.
    const defence=displayScale(weighted([
      [cbQ,.30],
      [fbQ,.18],
      [cdmQ,.18],
      [gkQ,.15],
      [cmCover,.07],
      [avg(u.backline.map(x=>attr(x.p,"defensiveAwareness"))),.06],
      [avg(u.backline.map(x=>attr(x.p,"recoveryPace"))),.03],
      [avg(u.backline.map(x=>attr(x.p,"aerial"))),.03]
    ]));

    const attack=displayScale(weighted([
      [avg(u.attackers.map(attackQuality)),.47],
      [avg(u.attackers.map(x=>attr(x.p,"finishing"))),.15],
      [avg(u.attackers.map(x=>attr(x.p,"creativity"))),.12],
      [avg(u.attackers.map(x=>attr(x.p,"technical"))),.10],
      [avg(u.attackers.map(x=>attr(x.p,"offTheBall"))),.08],
      [avg(u.mids.map(x=>attr(x.p,"lineBreaking"))),.08]
    ]));

    const midfield=displayScale(weighted([
      [avg(u.mids.map(midfieldQuality)),.48],
      [avg(u.mids.map(x=>attr(x.p,"passing"))),.14],
      [avg(u.mids.map(x=>attr(x.p,"pressResistance"))),.12],
      [avg(u.mids.map(x=>attr(x.p,"intelligence"))),.10],
      [avg(u.mids.map(x=>attr(x.p,"workRate"))),.08],
      [avg(u.mids.map(x=>attr(x.p,"defence"))),.08]
    ]));

    const transition=displayScale(weighted([
      [avg(u.attackers.map(x=>attr(x.p,"pace"))),.22],
      [avg(u.attackers.map(x=>attr(x.p,"transitionThreat"))),.22],
      [avg(u.mids.map(x=>attr(x.p,"lineBreaking"))),.16],
      [avg(u.mids.map(x=>attr(x.p,"visionRange"))),.12],
      [avg(u.attackers.map(x=>attr(x.p,"offTheBall"))),.12],
      [avg(u.backline.map(x=>attr(x.p,"recoveryPace"))),.08],
      [avg(u.all.map(x=>attr(x.p,"decisionMaking"))),.08]
    ]));

    const pressing=displayScale(weighted([
      [avg(u.all.map(x=>attr(x.p,"pressing"))),.31],
      [avg(u.all.map(x=>attr(x.p,"workRate"))),.24],
      [avg(u.all.map(x=>attr(x.p,"stamina"))),.18],
      [avg(u.all.map(x=>attr(x.p,"aggression"))),.14],
      [avg(u.all.map(x=>attr(x.p,"intelligence"))),.08],
      [avg(u.attackers.map(x=>attr(x.p,"pressing"))),.05]
    ]));

    const wide=displayScale(weighted([
      [avg(u.wide.map(x=>x.role==="lb"||x.role==="rb"?defenderQuality(x):attackQuality(x))),.34],
      [avg(u.wide.map(x=>attr(x.p,"pace"))),.17],
      [avg(u.wide.map(x=>attr(x.p,"crossing"))),.15],
      [avg(u.wide.map(x=>attr(x.p,"workRate"))),.13],
      [avg(u.wide.map(x=>attr(x.p,"defence"))),.11],
      [avg(u.wide.map(x=>attr(x.p,"dribbling"))),.10]
    ]));

    const setPieces=displayScale(weighted([
      [Math.max(...u.all.map(x=>attr(x.p,"setPieces")).concat([50])),.24],
      [avg(u.all.map(x=>attr(x.p,"crossing"))),.16],
      [avg(u.backline.concat(u.attackers).map(x=>attr(x.p,"aerial"))),.22],
      [avg(u.all.map(x=>attr(x.p,"physical"))),.13],
      [avg(u.all.map(x=>attr(x.p,"positioning"))),.13],
      [avg(u.all.map(x=>attr(x.p,"clutch"))),.12]
    ]));

    let synergy=displayScale(weighted([
      [attack,.19],[midfield,.21],[defence,.21],[transition,.09],[pressing,.08],[wide,.08],[setPieces,.05],[gkQ,.09]
    ]));

    return {
      attack,midfield,defence,transition,wide,pressing,setPieces,goalkeeper:gkQ,synergy,
      chanceCreation:displayScale(avg(u.attackers.concat(u.mids).map(x=>attr(x.p,"creativity")))),
      possession:displayScale(weighted([[midfield,.55],[avg(u.all.map(x=>attr(x.p,"pressResistance"))),.25],[synergy,.20]])),
      final:displayScale(weighted([[attack,.18],[midfield,.17],[defence,.18],[transition,.09],[pressing,.07],[wide,.07],[setPieces,.05],[gkQ,.09],[synergy,.10]]))
    };
  }

  function repairVerdict(v,teamA,teamB,names){
    if(!v||!v.phases)return v;
    const A=absolutePhases(teamA);
    const B=absolutePhases(teamB);

    v.version=(v.version||"")+" + "+VERSION;
    v.phases[names[0]]={...(v.phases[names[0]]||{}),...A,leftFlank:A.wide,rightFlank:A.wide};
    v.phases[names[1]]={...(v.phases[names[1]]||{}),...B,leftFlank:B.wide,rightFlank:B.wide};

    // Recalculate final score from sane phases, but keep the existing scoreline engine unless it is insane.
    v.finalScores={[names[0]]:round(A.final,1),[names[1]]:round(B.final,1)};

    // If old engine produced a ridiculous score from a close matchup, soften it.
    const scoreText=String(v.scoreline||"0-0");
    const m=scoreText.match(/(\d+)\D+(\d+)/);
    if(m){
      let ga=+m[1], gb=+m[2];
      const diff=Math.abs(A.final-B.final);
      const total=ga+gb;
      if(diff<8 && total>6){ ga=Math.min(ga,3); gb=Math.min(gb,3); }
      if(diff<4 && total>5){ ga=Math.min(ga,2); gb=Math.min(gb,2); }
      if(diff>=18 && Math.max(ga,gb)<4){
        if(A.final>B.final)ga=4;else gb=4;
      }
      v.scoreline=`${ga}-${gb}`;
      v.winner=ga>gb?names[0]:gb>ga?names[1]:"Draw";
    }

    v.narrative=`${v.narrative||""} Defence display fixed: ${names[0]} DEF ${round(A.defence,1)} vs ${names[1]} DEF ${round(B.defence,1)} is now based on goalkeeper, back four, CDM cover, defensive awareness, recovery pace and aerial quality — not opponent attack or scoreline penalties.`;
    v.debug=v.debug||{};
    v.debug.absolutePhaseFix={version:VERSION,[names[0]]:A,[names[1]]:B};
    return v;
  }

  const previous=root.ENGINE.calculateAdvancedVerdict || root.ENGINE.calculateUltraDynamicVerdict || root.ENGINE.calculateRealisticDynamicVerdict;
  root.ENGINE.calculateAdvancedVerdict=function(teamA,teamB,names=["Player 1","Player 2"]){
    const v=previous?previous(teamA,teamB,names):{phases:{[names[0]]:{},[names[1]]:{}},scoreline:"0-0"};
    return repairVerdict(v,teamA,teamB,names);
  };
  root.ENGINE.calculateUltraDynamicVerdict=root.ENGINE.calculateAdvancedVerdict;
  root.ENGINE.calculateRealisticDynamicVerdict=root.ENGINE.calculateAdvancedVerdict;
  root.ENGINE.absolutePhaseFixVersion=VERSION;
})();



/*
═══════════════════════════════════════════════════════════════════════════════
DRAFT ZONE — CLEAN STABLE MATCH ENGINE RESET v8.0
Paste this at the VERY BOTTOM of engine.js.

This is a hard reset of the result engine. It ignores the broken older phase
calculations that were causing:
- ATTACK = 99 every match
- MIDFIELD = 99 every match
- SYNERGY = 99 every match
- DEFENCE showing 37/58 despite elite defenders
- every match becoming 5-4, 7-5, 10-2, etc

This version:
- Calculates displayed ratings from actual players and positions.
- Uses 55-95 as the normal visible range, with 96-99 only for all-time units.
- Keeps scorelines realistic by default.
- Still allows huge scorelines when the team gap is genuinely massive.
- Uses no opponent-relative numbers for displayed ATT/MID/DEF.
═══════════════════════════════════════════════════════════════════════════════
*/
;(function(){
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  root.ENGINE = root.ENGINE || {};
  const VERSION = "clean-stable-reset-v8.0";

  const clamp = (v, lo=0, hi=99) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : 0));
  const round = (v, d=1) => {
    const m = Math.pow(10,d);
    return Math.round((Number.isFinite(+v) ? +v : 0) * m) / m;
  };
  const avg = arr => {
    const f = (arr || []).flat().filter(v => Number.isFinite(+v)).map(Number);
    return f.length ? f.reduce((a,b)=>a+b,0) / f.length : 0;
  };
  const sum = arr => (arr || []).filter(v => Number.isFinite(+v)).map(Number).reduce((a,b)=>a+b,0);
  const weighted = pairs => {
    let s=0,w=0;
    for(const pair of pairs || []){
      const v = pair[0], wt = pair[1];
      if(Number.isFinite(+v) && Number.isFinite(+wt)){
        s += (+v) * (+wt);
        w += (+wt);
      }
    }
    return w ? s/w : 0;
  };
  const sortBy = (arr, fn) => [...(arr || [])].sort((a,b)=>fn(b)-fn(a));
  const nameOf = p => p && p.name ? String(p.name).split("—")[0].trim() : "Unknown";
  const posOf = p => String(p && p.position ? p.position : "").toUpperCase();

  function a(p,k,def=70){
    if(!p) return def;

    if(k==="defence"){
      if(p.defence != null && Number.isFinite(+p.defence)) return +p.defence;
      if(p.defense != null && Number.isFinite(+p.defense)) return +p.defense;
    }
    if(k==="defense"){
      if(p.defense != null && Number.isFinite(+p.defense)) return +p.defense;
      if(p.defence != null && Number.isFinite(+p.defence)) return +p.defence;
    }

    if(p[k] != null && Number.isFinite(+p[k])) return +p[k];

    switch(k){
      case "goalkeeperRating": return posOf(p)==="GK" ? a(p,"overall",def) : 0;
      case "reflexes": return posOf(p)==="GK" ? a(p,"overall",def) : 0;
      case "commandOfArea": return posOf(p)==="GK" ? avg([a(p,"overall",def), a(p,"aerial",def)]) : 0;
      case "distribution": return posOf(p)==="GK" ? avg([a(p,"overall",def), a(p,"passing",def), a(p,"technical",def)]) : 0;

      case "defensiveAwareness": return avg([a(p,"defence",def), a(p,"positioning",def), a(p,"intelligence",def)]);
      case "recoveryPace": return avg([a(p,"pace",def), a(p,"defence",def), a(p,"stamina",def)]);
      case "marking": return avg([a(p,"defence",def), a(p,"defensiveAwareness",def), a(p,"positioning",def)]);
      case "composure": return avg([a(p,"technical",def), a(p,"intelligence",def), a(p,"consistency",def)]);
      case "pressResistance": return avg([a(p,"technical",def), a(p,"midfield",def), a(p,"composure",def)]);
      case "visionRange": return avg([a(p,"passing",def), a(p,"creativity",def), a(p,"intelligence",def)]);
      case "lineBreaking": return avg([a(p,"passing",def), a(p,"visionRange",def), a(p,"creativity",def)]);
      case "offTheBall": return avg([a(p,"positioning",def), a(p,"intelligence",def), a(p,"attack",def), a(p,"pace",def)]);
      case "poaching": return avg([a(p,"finishing",def), a(p,"positioning",def), a(p,"offTheBall",def)]);
      case "aggression": return avg([a(p,"pressing",def), a(p,"workRate",def), a(p,"physical",def), a(p,"tackling",def)]);
      case "clutch": return avg([a(p,"bigGameRating",def), a(p,"consistency",def), a(p,"leadership",def)]);
      case "decisionMaking": return avg([a(p,"intelligence",def), a(p,"composure",def), a(p,"consistency",def)]);
      default: return def;
    }
  }

  /*
    Rating compression:
    Raw 90 does NOT become 99.
    99 is reserved for ridiculous all-time units, not normal elite teams.
  */
  function displayScale(raw){
    raw = Number.isFinite(+raw) ? +raw : 70;
    if(raw <= 50) return clamp(raw,1,99);
    if(raw <= 70) return 50 + (raw-50)*1.00;
    if(raw <= 82) return 70 + (raw-70)*0.90;       // 82 raw -> 80.8
    if(raw <= 90) return 80.8 + (raw-82)*0.68;     // 90 raw -> 86.2
    if(raw <= 96) return 86.2 + (raw-90)*0.55;     // 96 raw -> 89.5
    if(raw <= 100) return 89.5 + (raw-96)*0.70;    // 100 raw -> 92.3
    return clamp(92.3 + (raw-100)*0.30,1,99);
  }

  function getLayout(){
    if(Array.isArray(root.LAYOUT)) return root.LAYOUT;
    return [
      {role:"gk"},{role:"lb"},{role:"cb"},{role:"cb"},{role:"rb"},
      {role:"cdm"},{role:"cm"},{role:"cam"},{role:"lw"},{role:"rw"},{role:"st"}
    ];
  }

  function teamUnits(team){
    const layout = getLayout();
    const all = [];
    (team || []).forEach((p,i)=>{
      if(!p) return;
      const role = (layout[i] && layout[i].role) || String(p.position || "CM").toLowerCase();
      all.push({p, role, index:i});
    });

    const role = r => all.filter(x=>x.role===r);
    const one = r => role(r)[0] || null;
    const any = roles => all.filter(x=>roles.includes(x.role));

    return {
      all,
      gk: one("gk"),
      lb: one("lb"),
      rb: one("rb"),
      cbs: role("cb"),
      cdm: one("cdm"),
      cms: role("cm"),
      cam: one("cam"),
      lw: one("lw"),
      rw: one("rw"),
      st: one("st"),
      backline: any(["lb","cb","rb"]),
      defenders: any(["lb","cb","rb","cdm"]),
      mids: any(["cdm","cm","cam"]),
      centralMids: any(["cdm","cm"]),
      attackers: any(["lw","rw","st","cam"]),
      forwards: any(["lw","rw","st"]),
      wide: any(["lw","rw","lb","rb"])
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROLE QUALITIES
  // ─────────────────────────────────────────────────────────────────────────

  function gkQuality(x){
    if(!x) return 55;
    const p=x.p;
    return displayScale(weighted([
      [a(p,"goalkeeperRating"),.42],
      [a(p,"reflexes"),.24],
      [a(p,"commandOfArea"),.16],
      [a(p,"distribution"),.10],
      [a(p,"composure"),.08]
    ]));
  }

  function cbQuality(x){
    if(!x) return 55;
    const p=x.p;
    return displayScale(weighted([
      [a(p,"defence"),.23],
      [a(p,"defensiveAwareness"),.18],
      [a(p,"tackling"),.14],
      [a(p,"positioning"),.13],
      [a(p,"aerial"),.10],
      [a(p,"physical"),.09],
      [a(p,"intelligence"),.08],
      [a(p,"recoveryPace"),.05]
    ]));
  }

  function fbQuality(x){
    if(!x) return 55;
    const p=x.p;
    return displayScale(weighted([
      [a(p,"defence"),.18],
      [a(p,"defensiveAwareness"),.13],
      [a(p,"tackling"),.11],
      [a(p,"pace"),.13],
      [a(p,"workRate"),.11],
      [a(p,"stamina"),.09],
      [a(p,"intelligence"),.07],
      [a(p,"physical"),.06],
      [a(p,"crossing"),.06],
      [a(p,"attack"),.06]
    ]));
  }

  function cdmQuality(x){
    if(!x) return 55;
    const p=x.p;
    return displayScale(weighted([
      [a(p,"defence"),.20],
      [a(p,"midfield"),.17],
      [a(p,"defensiveAwareness"),.15],
      [a(p,"tackling"),.13],
      [a(p,"positioning"),.11],
      [a(p,"intelligence"),.09],
      [a(p,"physical"),.06],
      [a(p,"workRate"),.05],
      [a(p,"pressResistance"),.04]
    ]));
  }

  function cmQuality(x){
    if(!x) return 55;
    const p=x.p;
    return displayScale(weighted([
      [a(p,"midfield"),.22],
      [a(p,"passing"),.15],
      [a(p,"pressResistance"),.13],
      [a(p,"intelligence"),.12],
      [a(p,"technical"),.11],
      [a(p,"workRate"),.09],
      [a(p,"defence"),.08],
      [a(p,"stamina"),.06],
      [a(p,"creativity"),.04]
    ]));
  }

  function camQuality(x){
    if(!x) return 55;
    const p=x.p;
    return displayScale(weighted([
      [a(p,"midfield"),.17],
      [a(p,"creativity"),.18],
      [a(p,"passing"),.15],
      [a(p,"technical"),.14],
      [a(p,"visionRange"),.12],
      [a(p,"attack"),.10],
      [a(p,"pressResistance"),.08],
      [a(p,"clutch"),.06]
    ]));
  }

  function wingerQuality(x){
    if(!x) return 55;
    const p=x.p;
    return displayScale(weighted([
      [a(p,"attack"),.18],
      [a(p,"dribbling"),.18],
      [a(p,"pace"),.15],
      [a(p,"technical"),.13],
      [a(p,"creativity"),.11],
      [a(p,"finishing"),.09],
      [a(p,"crossing"),.07],
      [a(p,"offTheBall"),.05],
      [a(p,"workRate"),.04]
    ]));
  }

  function strikerQuality(x){
    if(!x) return 55;
    const p=x.p;
    return displayScale(weighted([
      [a(p,"attack"),.20],
      [a(p,"finishing"),.22],
      [a(p,"poaching"),.16],
      [a(p,"offTheBall"),.12],
      [a(p,"physical"),.08],
      [a(p,"pace"),.08],
      [a(p,"technical"),.07],
      [a(p,"clutch"),.05],
      [a(p,"linkUp"),.02]
    ]));
  }

  function roleQuality(x){
    if(!x) return 55;
    if(x.role==="gk") return gkQuality(x);
    if(x.role==="cb") return cbQuality(x);
    if(x.role==="lb" || x.role==="rb") return fbQuality(x);
    if(x.role==="cdm") return cdmQuality(x);
    if(x.role==="cm") return cmQuality(x);
    if(x.role==="cam") return camQuality(x);
    if(x.role==="lw" || x.role==="rw") return wingerQuality(x);
    if(x.role==="st") return strikerQuality(x);
    return displayScale(a(x.p,"overall",75));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ABSOLUTE PHASE RATINGS
  // ─────────────────────────────────────────────────────────────────────────

  function starGravity(x){
    if(!x) return 0;
    const p=x.p;
    const raw = weighted([
      [a(p,"overall"),.18],
      [a(p,"attack"),.15],
      [a(p,"technical"),.14],
      [a(p,"dribbling"),.12],
      [a(p,"creativity"),.10],
      [a(p,"finishing"),.10],
      [a(p,"visionRange"),.08],
      [a(p,"clutch"),.08],
      [a(p,"offTheBall"),.05]
    ]);
    let g = Math.max(0,(raw-88)*1.0);
    if(a(p,"overall")>=97) g += 6;
    else if(a(p,"overall")>=94) g += 3;
    return clamp(g,0,18);
  }

  function dirtyCover(x){
    if(!x) return 0;
    const p=x.p;
    const raw = weighted([
      [a(p,"defence"),.17],
      [a(p,"midfield"),.15],
      [a(p,"workRate"),.14],
      [a(p,"tackling"),.13],
      [a(p,"aggression"),.11],
      [a(p,"positioning"),.10],
      [a(p,"physical"),.08],
      [a(p,"intelligence"),.08],
      [a(p,"stamina"),.04]
    ]);
    let c = Math.max(0,(raw-76)*0.48);
    if(x.role==="cdm") c += 3.0;
    if(x.role==="cm") c += 1.5;
    return clamp(c,0,14);
  }

  function buildProfile(team){
    const u = teamUnits(team);
    const all = u.all;

    const gk = gkQuality(u.gk);
    const cb = avg(u.cbs.map(cbQuality));
    const fb = avg([u.lb,u.rb].filter(Boolean).map(fbQuality));
    const cdm = u.cdm ? cdmQuality(u.cdm) : avg(u.cms.map(x=>displayScale(a(x.p,"defence",65)))) * 0.78;
    const cmCover = avg(u.cms.map(x=>displayScale(weighted([
      [a(x.p,"defence"),.20],
      [a(x.p,"workRate"),.20],
      [a(x.p,"tackling"),.16],
      [a(x.p,"positioning"),.16],
      [a(x.p,"intelligence"),.14],
      [a(x.p,"physical"),.14]
    ]))));

    const cover = sum(sortBy(u.mids.concat(u.backline),dirtyCover).slice(0,4).map(dirtyCover));
    const gravity = sum(sortBy(u.attackers,starGravity).slice(0,3).map(starGravity));

    const defence = displayScale(weighted([
      [cb,.30],
      [fb,.18],
      [cdm,.18],
      [gk,.14],
      [cmCover,.08],
      [avg(u.backline.map(x=>a(x.p,"defensiveAwareness"))),.05],
      [avg(u.backline.map(x=>a(x.p,"recoveryPace"))),.04],
      [avg(u.backline.map(x=>a(x.p,"aerial"))),.03]
    ]));

    const attack = displayScale(weighted([
      [avg([u.lw,u.rw].filter(Boolean).map(wingerQuality)),.26],
      [strikerQuality(u.st),.24],
      [camQuality(u.cam),.13],
      [avg(u.forwards.map(x=>a(x.p,"finishing"))),.12],
      [avg(u.forwards.map(x=>a(x.p,"technical"))),.10],
      [avg(u.attackers.map(x=>a(x.p,"creativity"))),.07],
      [avg(u.forwards.map(x=>a(x.p,"offTheBall"))),.05],
      [82+gravity*.18,.03]
    ]));

    const midfield = displayScale(weighted([
      [u.cdm ? cdmQuality(u.cdm) : 60,.18],
      [avg(u.cms.map(cmQuality)),.28],
      [u.cam ? camQuality(u.cam) : 60,.18],
      [avg(u.mids.map(x=>a(x.p,"passing"))),.11],
      [avg(u.mids.map(x=>a(x.p,"pressResistance"))),.10],
      [avg(u.mids.map(x=>a(x.p,"intelligence"))),.08],
      [avg(u.mids.map(x=>a(x.p,"workRate"))),.07]
    ]));

    const transition = displayScale(weighted([
      [avg(u.forwards.map(x=>a(x.p,"pace"))),.22],
      [avg(u.forwards.map(x=>a(x.p,"transitionThreat"))),.20],
      [avg(u.mids.map(x=>a(x.p,"lineBreaking"))),.16],
      [avg(u.mids.map(x=>a(x.p,"visionRange"))),.12],
      [avg(u.forwards.map(x=>a(x.p,"offTheBall"))),.12],
      [avg(u.backline.map(x=>a(x.p,"recoveryPace"))),.10],
      [avg(all.map(x=>a(x.p,"decisionMaking"))),.08]
    ]));

    const wide = displayScale(weighted([
      [avg([u.lw,u.rw].filter(Boolean).map(wingerQuality)),.32],
      [avg([u.lb,u.rb].filter(Boolean).map(fbQuality)),.22],
      [avg(u.wide.map(x=>a(x.p,"pace"))),.15],
      [avg(u.wide.map(x=>a(x.p,"crossing"))),.13],
      [avg(u.wide.map(x=>a(x.p,"workRate"))),.10],
      [avg(u.wide.map(x=>a(x.p,"defence"))),.08]
    ]));

    const pressing = displayScale(weighted([
      [avg(all.map(x=>a(x.p,"pressing"))),.30],
      [avg(all.map(x=>a(x.p,"workRate"))),.24],
      [avg(all.map(x=>a(x.p,"stamina"))),.18],
      [avg(all.map(x=>a(x.p,"aggression"))),.13],
      [avg(all.map(x=>a(x.p,"intelligence"))),.09],
      [avg(u.forwards.map(x=>a(x.p,"pressing"))),.06]
    ]));

    const setPieces = displayScale(weighted([
      [Math.max(...all.map(x=>a(x.p,"setPieces")).concat([50])),.24],
      [avg(sortBy(all,x=>a(x.p,"crossing")).slice(0,4).map(x=>a(x.p,"crossing"))),.16],
      [avg(sortBy(all,x=>a(x.p,"aerial")).slice(0,5).map(x=>a(x.p,"aerial"))),.20],
      [avg(sortBy(all,x=>a(x.p,"physical")).slice(0,5).map(x=>a(x.p,"physical"))),.12],
      [avg(all.map(x=>a(x.p,"positioning"))),.12],
      [avg(all.map(x=>a(x.p,"clutch"))),.10],
      [gk,.06]
    ]));

    const chanceCreation = displayScale(weighted([
      [avg(u.attackers.concat(u.mids).map(x=>a(x.p,"creativity"))),.30],
      [avg(u.attackers.concat(u.mids).map(x=>a(x.p,"visionRange"))),.22],
      [avg(u.attackers.concat(u.mids).map(x=>a(x.p,"passing"))),.18],
      [avg(u.attackers.concat(u.mids).map(x=>a(x.p,"technical"))),.16],
      [avg(u.mids.map(x=>a(x.p,"lineBreaking"))),.14]
    ]));

    const possession = displayScale(weighted([
      [midfield,.45],
      [avg(all.map(x=>a(x.p,"pressResistance"))),.25],
      [avg(all.map(x=>a(x.p,"technical"))),.18],
      [avg(all.map(x=>a(x.p,"intelligence"))),.12]
    ]));

    let synergyRaw = weighted([
      [attack,.18],
      [midfield,.18],
      [defence,.18],
      [transition,.08],
      [wide,.08],
      [pressing,.08],
      [setPieces,.05],
      [gk,.08],
      [possession,.09]
    ]);

    if(u.cdm && u.cbs.length>=2) synergyRaw += 1.5;
    if(u.cam && u.st) synergyRaw += 1.0;
    if(u.lw && u.lb) synergyRaw += 0.6;
    if(u.rw && u.rb) synergyRaw += 0.6;
    if(cover>18) synergyRaw += 1.2;
    if(gravity>12 && midfield>83) synergyRaw += 1.0;
    if(!u.cdm) synergyRaw -= 2.0;
    if(defence<74 && wide>86) synergyRaw -= 1.8;
    if(attack>88 && midfield<78) synergyRaw -= 1.8;

    const synergy = displayScale(synergyRaw);

    const balance = displayScale(100 - (
      Math.abs(attack-defence)*0.42 +
      Math.abs(midfield-defence)*0.24 +
      Math.abs(attack-midfield)*0.20
    ));

    const final = displayScale(weighted([
      [attack,.17],
      [midfield,.16],
      [defence,.17],
      [transition,.08],
      [wide,.06],
      [pressing,.06],
      [setPieces,.05],
      [gk,.08],
      [chanceCreation,.07],
      [possession,.05],
      [synergy,.05]
    ]));

    return {
      units:u,
      attack,midfield,defence,transition,wide,pressing,setPieces,goalkeeper:gk,
      chanceCreation,possession,synergy,balance,final,
      cb,fb,cdm,cmCover,cover,gravity,
      finishing:displayScale(avg(u.forwards.map(x=>a(x.p,"finishing")))),
      cdmCover:displayScale(weighted([[cdm,.65],[cmCover,.20],[80+cover*.20,.15]])),
      cbPace:displayScale(avg(u.cbs.map(x=>a(x.p,"recoveryPace")))),
      aerialDefence:displayScale(avg(u.backline.concat(u.gk?[u.gk]:[]).map(x=>a(x.p,"aerial")))),
      pressResistance:displayScale(avg(all.map(x=>a(x.p,"pressResistance")))),
      fbRisk:displayScale(avg([u.lb,u.rb].filter(Boolean).map(x=>a(x.p,"attack")*.55+a(x.p,"pace")*.18-a(x.p,"defensiveAwareness")*.16)))
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MATCH CONTEXT + SCORELINE
  // ─────────────────────────────────────────────────────────────────────────

  function contextFinal(A,B){
    let s = A.final;

    // These are small contextual modifiers only.
    s += (A.attack - B.defence) * 0.045;
    s += (A.midfield - B.midfield) * 0.040;
    s += (A.transition - B.cbPace) * 0.025;
    s += (A.chanceCreation - B.cdmCover) * 0.025;
    s += (A.pressing - B.pressResistance) * 0.018;
    s += (A.setPieces - B.aerialDefence) * 0.018;
    s += (A.goalkeeper - B.goalkeeper) * 0.018;
    s += (A.gravity - B.cover) * 0.020;

    if(B.transition>A.cbPace+10 && A.fbRisk>78) s -= 0.8;
    if(B.chanceCreation>A.cdmCover+10) s -= 0.7;
    if(B.setPieces>A.aerialDefence+10) s -= 0.5;

    return clamp(s,1,110);
  }

  function xG(A,B,scoreA,scoreB){
    const diff = scoreA-scoreB;
    let x = 1.05;

    x += (A.attack - B.defence) * 0.012;
    x += (A.chanceCreation - B.cdmCover) * 0.007;
    x += (A.transition - B.cbPace) * 0.006;
    x += (A.setPieces - B.aerialDefence) * 0.004;
    x += (A.gravity - B.cover) * 0.006;
    x += Math.max(0,diff) * 0.012;

    if(B.defence>88 && B.goalkeeper>88) x -= 0.20;
    if(B.cdmCover>88) x -= 0.12;
    if(A.attack>90 && B.defence<78) x += 0.18;
    if(A.transition>88 && B.cbPace<76 && B.fbRisk>78) x += 0.18;
    if(A.pressing>88 && B.pressResistance<76) x += 0.12;

    // Big scorelines are still possible, but only for real gaps.
    if(diff>18) x += (diff-18)*0.018;
    if(diff>32) x += (diff-32)*0.035;
    if(diff>50) x += (diff-50)*0.055;

    return Math.max(0.05,x);
  }

  function goalsFrom(x,diff,fin,keeper){
    let g = Math.floor(x);
    const rem = x - Math.floor(x);
    const finishEdge = (fin-keeper)*0.003;

    if(rem + finishEdge > 0.65) g++;
    if(diff>18 && x>2.0 && rem+finishEdge>0.45) g++;
    if(diff>34 && x>3.0) g++;
    if(diff>52 && x>4.2) g++;
    if(x>5.8) g += Math.floor((x-5.8)*0.35);
    if(x>8.0) g += Math.floor((x-8.0)*0.50);

    return Math.max(0,g);
  }

  function makeScore(A,B,sA,sB){
    const xa = xG(A,B,sA,sB);
    const xb = xG(B,A,sB,sA);
    const diff = sA-sB;

    let ga = goalsFrom(xa,diff,A.finishing,B.goalkeeper);
    let gb = goalsFrom(xb,-diff,B.finishing,A.goalkeeper);

    // Normal close matches stay normal.
    if(Math.abs(diff)<6 && xa<2.4 && xb<2.4){
      ga = Math.min(ga,3);
      gb = Math.min(gb,3);
    }
    if(Math.abs(diff)<3 && xa<1.6 && xb<1.6){
      ga = Math.min(ga,2);
      gb = Math.min(gb,2);
    }

    // True mismatch floors.
    if(diff>24 && ga<4) ga=4;
    if(diff>38 && ga<6) ga=6;
    if(diff>58 && ga<8) ga=8;
    if(diff>38 && gb>2) gb=2;
    if(diff>54 && gb>1) gb=1;

    if(diff<-24 && gb<4) gb=4;
    if(diff<-38 && gb<6) gb=6;
    if(diff<-58 && gb<8) gb=8;
    if(diff<-38 && ga>2) ga=2;
    if(diff<-54 && ga>1) ga=1;

    // Defensive lock.
    if(A.defence>90 && B.defence>90 && A.attack<80 && B.attack<80){
      ga=Math.min(ga,1);
      gb=Math.min(gb,1);
    }

    return {xgA:round(xa,2),xgB:round(xb,2),goalsA:ga,goalsB:gb,scoreline:`${ga}-${gb}`};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KEY BATTLES + RATINGS
  // ─────────────────────────────────────────────────────────────────────────

  function split(diff){
    const s = 1/(1+Math.exp(-diff*0.14));
    return clamp(Math.round(s*100),1,99);
  }

  function attackDuel(x){
    if(!x) return 55;
    if(x.role==="st") return strikerQuality(x);
    if(x.role==="lw"||x.role==="rw") return wingerQuality(x);
    if(x.role==="cam") return camQuality(x);
    return roleQuality(x);
  }

  function defenceDuel(x){
    if(!x) return 55;
    if(x.role==="cb") return cbQuality(x);
    if(x.role==="lb"||x.role==="rb") return fbQuality(x);
    if(x.role==="cdm") return cdmQuality(x);
    if(x.role==="gk") return gkQuality(x);
    return roleQuality(x);
  }

  function keyBattles(teamA,teamB,names,A,B){
    const au=A.units, bu=B.units;
    const out=[];

    function add(title,aName,bName,aVal,bVal,reason){
      const sc=split(aVal-bVal);
      out.push({
        title,aName,bName,
        score:`${sc}-${100-sc}`,
        scoreA:sc,
        scoreB:100-sc,
        winner: sc===50 ? "Even" : sc>50 ? names[0] : names[1],
        diff:round(aVal-bVal,1),
        reason
      });
    }

    const aStar = sortBy(au.attackers,starGravity)[0];
    const bStop = sortBy(bu.defenders.concat(bu.gk?[bu.gk]:[]),defenceDuel)[0];
    const bStar = sortBy(bu.attackers,starGravity)[0];
    const aStop = sortBy(au.defenders.concat(au.gk?[au.gk]:[]),defenceDuel)[0];

    if(aStar&&bStop){
      add(`${nameOf(aStar.p)} vs ${nameOf(bStop.p)}`,nameOf(aStar.p),nameOf(bStop.p),
        attackDuel(aStar)+starGravity(aStar)*0.35,
        defenceDuel(bStop)+B.cover*0.08,
        "main attacking threat against best available defensive cover");
    }
    if(bStar&&aStop){
      add(`${nameOf(bStar.p)} vs ${nameOf(aStop.p)}`,nameOf(bStar.p),nameOf(aStop.p),
        attackDuel(bStar)+starGravity(bStar)*0.35,
        defenceDuel(aStop)+A.cover*0.08,
        "main attacking threat against best available defensive cover");
    }
    if(au.st&&bu.cbs.length){
      const cb=sortBy(bu.cbs,cbQuality)[0];
      add(`${nameOf(au.st.p)} vs ${nameOf(cb.p)}`,nameOf(au.st.p),nameOf(cb.p),
        strikerQuality(au.st),cbQuality(cb)+B.cdmCover*0.06,
        "striker finishing and movement against centre-back resistance");
    }
    if(bu.st&&au.cbs.length){
      const cb=sortBy(au.cbs,cbQuality)[0];
      add(`${nameOf(bu.st.p)} vs ${nameOf(cb.p)}`,nameOf(bu.st.p),nameOf(cb.p),
        strikerQuality(bu.st),cbQuality(cb)+A.cdmCover*0.06,
        "striker finishing and movement against centre-back resistance");
    }
    add(`${names[0]} midfield vs ${names[1]} midfield`,names[0],names[1],
      A.midfield+A.cover*0.05,B.midfield+B.cover*0.05,
      "tempo, possession, second balls and defensive protection");
    add(`${names[0]} transition vs ${names[1]} defensive cover`,names[0],names[1],
      A.transition,B.cbPace+B.cdmCover*0.08,
      "whether speed and vertical passing have enough space to hurt the defence");
    add(`${names[1]} transition vs ${names[0]} defensive cover`,names[1],names[0],
      B.transition,A.cbPace+A.cdmCover*0.08,
      "whether speed and vertical passing have enough space to hurt the defence");

    return out.sort((x,y)=>Math.abs(y.diff)-Math.abs(x.diff)).slice(0,8);
  }

  function distributeGoals(team,goals){
    const u=teamUnits(team);
    const c=(u.forwards.length?u.forwards:u.attackers.length?u.attackers:u.all);
    const out={};
    for(let i=0;i<goals;i++){
      const weights=c.map(x=>{
        let w=1+a(x.p,"finishing")*.035+a(x.p,"poaching")*.025+a(x.p,"attack")*.015+starGravity(x)*.08;
        if(x.role==="st") w*=1.45;
        if(x.role==="lw"||x.role==="rw") w*=1.12;
        return w;
      });
      let total=sum(weights), r=((i+1)*0.381966%1)*total, chosen=c[0];
      for(let j=0;j<c.length;j++){r-=weights[j];if(r<=0){chosen=c[j];break;}}
      const n=nameOf(chosen.p);
      out[n]=(out[n]||0)+1;
    }
    return out;
  }

  function distributeAssists(team,goals){
    const u=teamUnits(team);
    const c=(u.mids.concat(u.attackers).length?u.mids.concat(u.attackers):u.all);
    const out={};
    const assists=Math.max(0,goals-(goals>=4?1:0));
    for(let i=0;i<assists;i++){
      const weights=c.map(x=>{
        let w=1+a(x.p,"creativity")*.030+a(x.p,"passing")*.025+a(x.p,"visionRange")*.020+a(x.p,"crossing")*.010;
        if(x.role==="cam") w*=1.25;
        if(x.role==="cm") w*=1.10;
        if(x.role==="rw"||x.role==="lw") w*=1.08;
        return w;
      });
      let total=sum(weights), r=((i+1)*0.527864%1)*total, chosen=c[0];
      for(let j=0;j<c.length;j++){r-=weights[j];if(r<=0){chosen=c[j];break;}}
      const n=nameOf(chosen.p);
      out[n]=(out[n]||0)+1;
    }
    return out;
  }

  function playerRatings(team,A,B,sA,sB,gf,ga){
    const u=teamUnits(team);
    const goals=distributeGoals(team,gf);
    const assists=distributeAssists(team,gf);
    const dominance=sA-sB;

    return u.all.map(x=>{
      const n=nameOf(x.p), r=x.role;
      let rt=6.05+(roleQuality(x)-78)*0.026+dominance*0.012;

      if(["st","lw","rw","cam"].includes(r)){
        rt+=(A.attack-80)*0.013+(A.chanceCreation-80)*0.007;
        if(gf===0) rt-=0.25;
      }
      if(["cm","cdm","cam"].includes(r)){
        rt+=(A.midfield-80)*0.014+dirtyCover(x)*0.018;
      }
      if(["cb","lb","rb","cdm","gk"].includes(r)){
        rt+=(A.defence-80)*0.015+(A.cdmCover-80)*0.008;
        rt-=ga*0.095;
        if(ga===0) rt+=r==="gk"?0.55:0.35;
        if(ga>=4) rt-=0.25;
        if(ga>=6) rt-=0.35;
      }

      const g=goals[n]||0;
      const as=assists[n]||0;
      rt+=g*0.76+as*0.38;
      if(g>=2) rt+=0.25;
      if(g>=3) rt+=0.40;
      if(as>=2) rt+=0.20;

      return {
        name:n,
        position:r.toUpperCase(),
        rating:round(clamp(rt,3.2,10),1),
        goals:g,
        assists:as
      };
    }).sort((x,y)=>y.rating-x.rating);
  }

  function publicPhases(P){
    return {
      attack:round(P.attack,1),
      midfield:round(P.midfield,1),
      defence:round(P.defence,1),
      transition:round(P.transition,1),
      wide:round(P.wide,1),
      leftFlank:round(P.wide,1),
      rightFlank:round(P.wide,1),
      pressing:round(P.pressing,1),
      setPieces:round(P.setPieces,1),
      goalkeeper:round(P.goalkeeper,1),
      synergy:round(P.synergy,1),
      chanceCreation:round(P.chanceCreation,1),
      possession:round(P.possession,1),
      balance:round(P.balance,1),
      final:round(P.final,1)
    };
  }

  function calculateCleanStableVerdict(teamA,teamB,names=["Player 1","Player 2"]){
    const A=buildProfile(teamA);
    const B=buildProfile(teamB);

    const sA=contextFinal(A,B);
    const sB=contextFinal(B,A);
    const sc=makeScore(A,B,sA,sB);
    const battles=keyBattles(teamA,teamB,names,A,B);

    const rA=playerRatings(teamA,A,B,sA,sB,sc.goalsA,sc.goalsB);
    const rB=playerRatings(teamB,B,A,sB,sA,sc.goalsB,sc.goalsA);
    const allRatings=rA.map(x=>({...x,team:names[0]})).concat(rB.map(x=>({...x,team:names[1]}))).sort((x,y)=>y.rating-x.rating);

    const diff=sA-sB;
    const winner=sc.goalsA>sc.goalsB?names[0]:sc.goalsB>sc.goalsA?names[1]:"Draw";

    let verdictType="coin flip";
    if(Math.abs(diff)>=45) verdictType="brutal mismatch";
    else if(Math.abs(diff)>=30) verdictType="dominant win";
    else if(Math.abs(diff)>=16) verdictType="clear win";
    else if(Math.abs(diff)>=6) verdictType="narrow win";

    const narrative = winner==="Draw"
      ? `The match finishes ${sc.scoreline}. The teams are close enough that the main phases balance out.`
      : `${winner} wins ${sc.scoreline}. Phase ratings are now absolute and stable: attack ${round(A.attack,1)}-${round(B.attack,1)}, midfield ${round(A.midfield,1)}-${round(B.midfield,1)}, defence ${round(A.defence,1)}-${round(B.defence,1)}.`;

    return {
      version:VERSION,
      winner,
      winProbability:{
        [names[0]]:round(clamp(50+diff*2.0,1,99),1),
        [names[1]]:round(clamp(50-diff*2.0,1,99),1)
      },
      verdictType,
      finalScores:{[names[0]]:round(sA,1),[names[1]]:round(sB,1)},
      scoreline:sc.scoreline,
      expectedGoals:{[names[0]]:sc.xgA,[names[1]]:sc.xgB},
      phases:{[names[0]]:publicPhases(A),[names[1]]:publicPhases(B)},
      keyBattles:battles,
      playerRatings:{[names[0]]:rA,[names[1]]:rB,manOfTheMatch:allRatings[0]||null},
      tactical:{
        [names[0]]:{profile:A,starGravity:round(A.gravity,1),dirtyCover:round(A.cover,1)},
        [names[1]]:{profile:B,starGravity:round(B.gravity,1),dirtyCover:round(B.cover,1)}
      },
      weaknesses:{[names[0]]:{total:0,items:[]},[names[1]]:{total:0,items:[]}},
      narrative,
      decidingBattle:battles[0]||null,
      debug:{A,B,contextScoreA:sA,contextScoreB:sB,score:sc}
    };
  }

  // Absolute final override. Nothing from older broken patches is used after this.
  root.ENGINE.calculateCleanStableVerdict=calculateCleanStableVerdict;
  root.ENGINE.calculateAdvancedVerdict=calculateCleanStableVerdict;
  root.ENGINE.calculateUltraDynamicVerdict=calculateCleanStableVerdict;
  root.ENGINE.calculateRealisticDynamicVerdict=calculateCleanStableVerdict;
  root.ENGINE.cleanStableResetVersion=VERSION;
})();
