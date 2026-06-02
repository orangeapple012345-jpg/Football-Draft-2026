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



/*
═══════════════════════════════════════════════════════════════════════════════
DRAFT ZONE — INDEX-COMPATIBLE STABLE ENGINE API FIX v9.0
Paste this at the VERY BOTTOM of engine.js.

IMPORTANT:
Your index.html does NOT use calculateAdvancedVerdict().
It uses these old functions:
- ENGINE.calcFullPhases()
- ENGINE.dynamicScoreline()
- ENGINE.dynamicPlayerRatings()
- ENGINE.dynamicGoalEvents()
- ENGINE.calcDeepPvP()
- ENGINE.deepTacticalBreakdown()
- ENGINE.contextualWeaknesses()

Previous fixes changed the wrong API, so the screen still showed 99 ATT/MID and bad DEF.
This patch overrides the exact functions index.html actually calls.
═══════════════════════════════════════════════════════════════════════════════
*/
;(function(){
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.ENGINE = root.ENGINE || {};
  const VERSION = "index-compatible-stable-api-v9.0";

  const clamp=(v,lo=0,hi=99)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:0));
  const round=(v,d=1)=>{const m=Math.pow(10,d);return Math.round((Number.isFinite(+v)?+v:0)*m)/m;};
  const avg=arr=>{const f=(arr||[]).flat().filter(v=>Number.isFinite(+v)).map(Number);return f.length?f.reduce((a,b)=>a+b,0)/f.length:0;};
  const sum=arr=>(arr||[]).filter(v=>Number.isFinite(+v)).map(Number).reduce((a,b)=>a+b,0);
  const weighted=pairs=>{let s=0,w=0;for(const [v,wt] of pairs||[]){if(Number.isFinite(+v)&&Number.isFinite(+wt)){s+=v*wt;w+=wt;}}return w?s/w:0;};
  const sortBy=(arr,fn)=>[...(arr||[])].sort((a,b)=>fn(b)-fn(a));
  const n=p=>p&&p.name?String(p.name).split("—")[0].trim():"Unknown";
  const pos=p=>String(p&&p.position?p.position:"").toUpperCase();

  function attr(p,k,def=70){
    if(!p)return def;
    if(k==="defence"){if(p.defence!=null&&Number.isFinite(+p.defence))return +p.defence;if(p.defense!=null&&Number.isFinite(+p.defense))return +p.defense;}
    if(k==="defense"){if(p.defense!=null&&Number.isFinite(+p.defense))return +p.defense;if(p.defence!=null&&Number.isFinite(+p.defence))return +p.defence;}
    if(p[k]!=null&&Number.isFinite(+p[k]))return +p[k];
    switch(k){
      case"goalkeeperRating":return pos(p)==="GK"?attr(p,"overall",def):0;
      case"reflexes":return pos(p)==="GK"?attr(p,"overall",def):0;
      case"commandOfArea":return pos(p)==="GK"?avg([attr(p,"overall",def),attr(p,"aerial",def)]):0;
      case"distribution":return pos(p)==="GK"?avg([attr(p,"overall",def),attr(p,"passing",def),attr(p,"technical",def)]):0;
      case"defensiveAwareness":return avg([attr(p,"defence",def),attr(p,"positioning",def),attr(p,"intelligence",def)]);
      case"recoveryPace":return avg([attr(p,"pace",def),attr(p,"defence",def),attr(p,"stamina",def)]);
      case"marking":return avg([attr(p,"defence",def),attr(p,"defensiveAwareness",def),attr(p,"positioning",def)]);
      case"composure":return avg([attr(p,"technical",def),attr(p,"intelligence",def),attr(p,"consistency",def)]);
      case"pressResistance":return avg([attr(p,"technical",def),attr(p,"midfield",def),attr(p,"composure",def)]);
      case"visionRange":return avg([attr(p,"passing",def),attr(p,"creativity",def),attr(p,"intelligence",def)]);
      case"lineBreaking":return avg([attr(p,"passing",def),attr(p,"visionRange",def),attr(p,"creativity",def)]);
      case"offTheBall":return avg([attr(p,"positioning",def),attr(p,"intelligence",def),attr(p,"attack",def),attr(p,"pace",def)]);
      case"poaching":return avg([attr(p,"finishing",def),attr(p,"positioning",def),attr(p,"offTheBall",def)]);
      case"aggression":return avg([attr(p,"pressing",def),attr(p,"workRate",def),attr(p,"physical",def),attr(p,"tackling",def)]);
      case"clutch":return avg([attr(p,"bigGameRating",def),attr(p,"consistency",def),attr(p,"leadership",def)]);
      case"decisionMaking":return avg([attr(p,"intelligence",def),attr(p,"composure",def),attr(p,"consistency",def)]);
      default:return def;
    }
  }

  // Visible ratings: 99 is almost impossible. Elite teams mostly show 84-92.
  function scale(raw){
    raw=Number.isFinite(+raw)?+raw:70;
    if(raw<=50)return clamp(raw,1,99);
    if(raw<=70)return 50+(raw-50)*1.00;
    if(raw<=82)return 70+(raw-70)*0.90;
    if(raw<=90)return 80.8+(raw-82)*0.68;
    if(raw<=96)return 86.2+(raw-90)*0.55;
    return clamp(89.5+(raw-96)*0.55,1,99);
  }

  function getLayout(){
    if(Array.isArray(root.LAYOUT))return root.LAYOUT;
    return [{role:"gk"},{role:"lb"},{role:"cb"},{role:"cb"},{role:"rb"},{role:"cdm"},{role:"cm"},{role:"cam"},{role:"lw"},{role:"rw"},{role:"st"}];
  }

  function units(sq){
    const L=getLayout(), all=[];
    (sq||[]).forEach((p,i)=>{
      if(!p)return;
      const role=(L[i]&&L[i].role)||String(p.position||"CM").toLowerCase();
      all.push({p,role,index:i});
    });
    const role=r=>all.filter(x=>x.role===r);
    const one=r=>role(r)[0]||null;
    const any=rs=>all.filter(x=>rs.includes(x.role));
    return{
      all,gk:one("gk"),lb:one("lb"),rb:one("rb"),cbs:role("cb"),cdm:one("cdm"),cms:role("cm"),cam:one("cam"),
      lw:one("lw"),rw:one("rw"),st:one("st"),
      backline:any(["lb","cb","rb"]),mids:any(["cdm","cm","cam"]),centralMids:any(["cdm","cm"]),
      attackers:any(["lw","rw","st","cam"]),forwards:any(["lw","rw","st"]),wide:any(["lw","rw","lb","rb"])
    };
  }

  function qGK(x){if(!x)return 55;const p=x.p;return scale(weighted([[attr(p,"goalkeeperRating"),.42],[attr(p,"reflexes"),.24],[attr(p,"commandOfArea"),.17],[attr(p,"distribution"),.09],[attr(p,"composure"),.08]]));}
  function qCB(x){if(!x)return 55;const p=x.p;return scale(weighted([[attr(p,"defence"),.23],[attr(p,"defensiveAwareness"),.18],[attr(p,"tackling"),.14],[attr(p,"positioning"),.13],[attr(p,"aerial"),.10],[attr(p,"physical"),.09],[attr(p,"intelligence"),.08],[attr(p,"recoveryPace"),.05]]));}
  function qFB(x){if(!x)return 55;const p=x.p;return scale(weighted([[attr(p,"defence"),.18],[attr(p,"defensiveAwareness"),.13],[attr(p,"tackling"),.11],[attr(p,"pace"),.13],[attr(p,"workRate"),.11],[attr(p,"stamina"),.09],[attr(p,"intelligence"),.07],[attr(p,"physical"),.06],[attr(p,"crossing"),.06],[attr(p,"attack"),.06]]));}
  function qCDM(x){if(!x)return 55;const p=x.p;return scale(weighted([[attr(p,"defence"),.20],[attr(p,"midfield"),.17],[attr(p,"defensiveAwareness"),.15],[attr(p,"tackling"),.13],[attr(p,"positioning"),.11],[attr(p,"intelligence"),.09],[attr(p,"physical"),.06],[attr(p,"workRate"),.05],[attr(p,"pressResistance"),.04]]));}
  function qCM(x){if(!x)return 55;const p=x.p;return scale(weighted([[attr(p,"midfield"),.22],[attr(p,"passing"),.15],[attr(p,"pressResistance"),.13],[attr(p,"intelligence"),.12],[attr(p,"technical"),.11],[attr(p,"workRate"),.09],[attr(p,"defence"),.08],[attr(p,"stamina"),.06],[attr(p,"creativity"),.04]]));}
  function qCAM(x){if(!x)return 55;const p=x.p;return scale(weighted([[attr(p,"midfield"),.17],[attr(p,"creativity"),.18],[attr(p,"passing"),.15],[attr(p,"technical"),.14],[attr(p,"visionRange"),.12],[attr(p,"attack"),.10],[attr(p,"pressResistance"),.08],[attr(p,"clutch"),.06]]));}
  function qW(x){if(!x)return 55;const p=x.p;return scale(weighted([[attr(p,"attack"),.18],[attr(p,"dribbling"),.18],[attr(p,"pace"),.15],[attr(p,"technical"),.13],[attr(p,"creativity"),.11],[attr(p,"finishing"),.09],[attr(p,"crossing"),.07],[attr(p,"offTheBall"),.05],[attr(p,"workRate"),.04]]));}
  function qST(x){if(!x)return 55;const p=x.p;return scale(weighted([[attr(p,"attack"),.20],[attr(p,"finishing"),.22],[attr(p,"poaching"),.16],[attr(p,"offTheBall"),.12],[attr(p,"physical"),.08],[attr(p,"pace"),.08],[attr(p,"technical"),.07],[attr(p,"clutch"),.05],[attr(p,"passing"),.02]]));}
  function roleQ(x){if(!x)return 55;if(x.role==="gk")return qGK(x);if(x.role==="cb")return qCB(x);if(x.role==="lb"||x.role==="rb")return qFB(x);if(x.role==="cdm")return qCDM(x);if(x.role==="cm")return qCM(x);if(x.role==="cam")return qCAM(x);if(x.role==="lw"||x.role==="rw")return qW(x);if(x.role==="st")return qST(x);return scale(attr(x.p,"overall",75));}

  function star(x){if(!x)return 0;const p=x.p;const raw=weighted([[attr(p,"overall"),.18],[attr(p,"attack"),.15],[attr(p,"technical"),.14],[attr(p,"dribbling"),.12],[attr(p,"creativity"),.10],[attr(p,"finishing"),.10],[attr(p,"visionRange"),.08],[attr(p,"clutch"),.08],[attr(p,"offTheBall"),.05]]);let g=Math.max(0,(raw-88)*1.0);if(attr(p,"overall")>=97)g+=6;else if(attr(p,"overall")>=94)g+=3;return clamp(g,0,18);}
  function cover(x){if(!x)return 0;const p=x.p;const raw=weighted([[attr(p,"defence"),.17],[attr(p,"midfield"),.15],[attr(p,"workRate"),.14],[attr(p,"tackling"),.13],[attr(p,"aggression"),.11],[attr(p,"positioning"),.10],[attr(p,"physical"),.08],[attr(p,"intelligence"),.08],[attr(p,"stamina"),.04]]);let c=Math.max(0,(raw-76)*.48);if(x.role==="cdm")c+=3;if(x.role==="cm")c+=1.5;return clamp(c,0,14);}

  function profile(sq){
    const U=units(sq), all=U.all;
    const gk=qGK(U.gk);
    const cb=avg(U.cbs.map(qCB));
    const fb=avg([U.lb,U.rb].filter(Boolean).map(qFB));
    const cdm=U.cdm?qCDM(U.cdm):avg(U.cms.map(x=>scale(attr(x.p,"defence",65))))*.78;
    const cmCover=avg(U.cms.map(x=>scale(weighted([[attr(x.p,"defence"),.20],[attr(x.p,"workRate"),.20],[attr(x.p,"tackling"),.16],[attr(x.p,"positioning"),.16],[attr(x.p,"intelligence"),.14],[attr(x.p,"physical"),.14]]))));
    const cov=sum(sortBy(U.mids.concat(U.backline),cover).slice(0,4).map(cover));
    const grav=sum(sortBy(U.attackers,star).slice(0,3).map(star));

    const defence=scale(weighted([[cb,.30],[fb,.18],[cdm,.18],[gk,.14],[cmCover,.08],[avg(U.backline.map(x=>attr(x.p,"defensiveAwareness"))),.05],[avg(U.backline.map(x=>attr(x.p,"recoveryPace"))),.04],[avg(U.backline.map(x=>attr(x.p,"aerial"))),.03]]));
    const attack=scale(weighted([[avg([U.lw,U.rw].filter(Boolean).map(qW)),.26],[qST(U.st),.24],[qCAM(U.cam),.13],[avg(U.forwards.map(x=>attr(x.p,"finishing"))),.12],[avg(U.forwards.map(x=>attr(x.p,"technical"))),.10],[avg(U.attackers.map(x=>attr(x.p,"creativity"))),.07],[avg(U.forwards.map(x=>attr(x.p,"offTheBall"))),.05],[82+grav*.18,.03]]));
    const midfield=scale(weighted([[U.cdm?qCDM(U.cdm):60,.18],[avg(U.cms.map(qCM)),.28],[U.cam?qCAM(U.cam):60,.18],[avg(U.mids.map(x=>attr(x.p,"passing"))),.11],[avg(U.mids.map(x=>attr(x.p,"pressResistance"))),.10],[avg(U.mids.map(x=>attr(x.p,"intelligence"))),.08],[avg(U.mids.map(x=>attr(x.p,"workRate"))),.07]]));
    const transition=scale(weighted([[avg(U.forwards.map(x=>attr(x.p,"pace"))),.22],[avg(U.forwards.map(x=>attr(x.p,"transitionThreat"))),.20],[avg(U.mids.map(x=>attr(x.p,"lineBreaking"))),.16],[avg(U.mids.map(x=>attr(x.p,"visionRange"))),.12],[avg(U.forwards.map(x=>attr(x.p,"offTheBall"))),.12],[avg(U.backline.map(x=>attr(x.p,"recoveryPace"))),.10],[avg(all.map(x=>attr(x.p,"decisionMaking"))),.08]]));
    const wide=scale(weighted([[avg([U.lw,U.rw].filter(Boolean).map(qW)),.32],[avg([U.lb,U.rb].filter(Boolean).map(qFB)),.22],[avg(U.wide.map(x=>attr(x.p,"pace"))),.15],[avg(U.wide.map(x=>attr(x.p,"crossing"))),.13],[avg(U.wide.map(x=>attr(x.p,"workRate"))),.10],[avg(U.wide.map(x=>attr(x.p,"defence"))),.08]]));
    const pressing=scale(weighted([[avg(all.map(x=>attr(x.p,"pressing"))),.30],[avg(all.map(x=>attr(x.p,"workRate"))),.24],[avg(all.map(x=>attr(x.p,"stamina"))),.18],[avg(all.map(x=>attr(x.p,"aggression"))),.13],[avg(all.map(x=>attr(x.p,"intelligence"))),.09],[avg(U.forwards.map(x=>attr(x.p,"pressing"))),.06]]));
    const setPieces=scale(weighted([[Math.max(...all.map(x=>attr(x.p,"setPieces")).concat([50])),.24],[avg(sortBy(all,x=>attr(x.p,"crossing")).slice(0,4).map(x=>attr(x.p,"crossing"))),.16],[avg(sortBy(all,x=>attr(x.p,"aerial")).slice(0,5).map(x=>attr(x.p,"aerial"))),.20],[avg(sortBy(all,x=>attr(x.p,"physical")).slice(0,5).map(x=>attr(x.p,"physical"))),.12],[avg(all.map(x=>attr(x.p,"positioning"))),.12],[avg(all.map(x=>attr(x.p,"clutch"))),.10],[gk,.06]]));
    const chanceCreation=scale(weighted([[avg(U.attackers.concat(U.mids).map(x=>attr(x.p,"creativity"))),.30],[avg(U.attackers.concat(U.mids).map(x=>attr(x.p,"visionRange"))),.22],[avg(U.attackers.concat(U.mids).map(x=>attr(x.p,"passing"))),.18],[avg(U.attackers.concat(U.mids).map(x=>attr(x.p,"technical"))),.16],[avg(U.mids.map(x=>attr(x.p,"lineBreaking"))),.14]]));
    const possession=scale(weighted([[midfield,.45],[avg(all.map(x=>attr(x.p,"pressResistance"))),.25],[avg(all.map(x=>attr(x.p,"technical"))),.18],[avg(all.map(x=>attr(x.p,"intelligence"))),.12]]));

    let synRaw=weighted([[attack,.18],[midfield,.18],[defence,.18],[transition,.08],[wide,.08],[pressing,.08],[setPieces,.05],[gk,.08],[possession,.09]]);
    if(U.cdm&&U.cbs.length>=2)synRaw+=1.5;if(U.cam&&U.st)synRaw+=1;if(U.lw&&U.lb)synRaw+=.6;if(U.rw&&U.rb)synRaw+=.6;if(cov>18)synRaw+=1.2;if(grav>12&&midfield>83)synRaw+=1;if(!U.cdm)synRaw-=2;if(defence<74&&wide>86)synRaw-=1.8;if(attack>88&&midfield<78)synRaw-=1.8;
    const synergy=scale(synRaw);
    const final=scale(weighted([[attack,.17],[midfield,.16],[defence,.17],[transition,.08],[wide,.06],[pressing,.06],[setPieces,.05],[gk,.08],[chanceCreation,.07],[possession,.05],[synergy,.05]]));

    return {U,attack,midfield,defence,transition,wide,pressing,setPieces,goalkeeper:gk,synergy,final,chanceCreation,possession,cb,fb,cdm,cmCover,cover:cov,gravity:grav,finishing:scale(avg(U.forwards.map(x=>attr(x.p,"finishing")))),cdmCover:scale(weighted([[cdm,.65],[cmCover,.20],[80+cov*.20,.15]])),cbPace:scale(avg(U.cbs.map(x=>attr(x.p,"recoveryPace")))),aerialDefence:scale(avg(U.backline.concat(U.gk?[U.gk]:[]).map(x=>attr(x.p,"aerial")))),pressResistance:scale(avg(all.map(x=>attr(x.p,"pressResistance")))),fbRisk:scale(avg([U.lb,U.rb].filter(Boolean).map(x=>attr(x.p,"attack")*.55+attr(x.p,"pace")*.18-attr(x.p,"defensiveAwareness")*.16)))};
  }

  function context(A,B){
    let s=A.final;
    s+=(A.attack-B.defence)*.045;
    s+=(A.midfield-B.midfield)*.040;
    s+=(A.transition-B.cbPace)*.025;
    s+=(A.chanceCreation-B.cdmCover)*.025;
    s+=(A.pressing-B.pressResistance)*.018;
    s+=(A.setPieces-B.aerialDefence)*.018;
    s+=(A.goalkeeper-B.goalkeeper)*.018;
    s+=(A.gravity-B.cover)*.020;
    if(B.transition>A.cbPace+10&&A.fbRisk>78)s-=.8;
    if(B.chanceCreation>A.cdmCover+10)s-=.7;
    if(B.setPieces>A.aerialDefence+10)s-=.5;
    return clamp(s,1,110);
  }

  function calcFullPhases(sqA,sqB){
    const A=profile(sqA),B=profile(sqB);
    const aFin=context(A,B),bFin=context(B,A);
    return {
      version:VERSION,
      PA:A,PB:B,TA:A,TB:B,tacA:{},tacB:{},
      aAtk:A.attack,bAtk:B.attack,
      aMid:A.midfield,bMid:B.midfield,
      aDefStr:A.defence,bDefStr:B.defence,
      aTrans:A.transition,bTrans:B.transition,
      aWide:A.wide,bWide:B.wide,
      aPressScore:A.pressing,bPressScore:B.pressing,
      aSP:A.setPieces,bSP:B.setPieces,
      aGK:A.goalkeeper,bGK:B.goalkeeper,
      aSynScore:A.synergy,bSynScore:B.synergy,
      synA:{score:A.synergy,log:synergyLog(A)},synB:{score:B.synergy,log:synergyLog(B)},
      aFin,bFin,
      momentum:{a:0,b:0}
    };
  }

  function synergyLog(P){
    const log=[];
    if(P.cover>14)log.push("Elite midfield cover protects the defensive line");
    if(P.gravity>10)log.push("Star player gravity creates extra defensive attention");
    if(P.cdmCover>84)log.push("Strong CDM screen protects central zones");
    if(P.attack>86&&P.chanceCreation>84)log.push("Attackers receive strong creative service");
    if(P.defence>86&&P.goalkeeper>86)log.push("Defence and goalkeeper form a strong shot-prevention unit");
    if(!log.length)log.push("Balanced structure without extreme tactical bonuses");
    return log;
  }

  function xgFor(A,B,aFin,bFin){
    const diff=aFin-bFin;
    let x=1.05;
    x+=(A.attack-B.defence)*.012;
    x+=(A.chanceCreation-B.cdmCover)*.007;
    x+=(A.transition-B.cbPace)*.006;
    x+=(A.setPieces-B.aerialDefence)*.004;
    x+=(A.gravity-B.cover)*.006;
    x+=Math.max(0,diff)*.012;
    if(B.defence>88&&B.goalkeeper>88)x-=.20;
    if(B.cdmCover>88)x-=.12;
    if(A.attack>90&&B.defence<78)x+=.18;
    if(A.transition>88&&B.cbPace<76&&B.fbRisk>78)x+=.18;
    if(A.pressing>88&&B.pressResistance<76)x+=.12;
    if(diff>18)x+=(diff-18)*.018;
    if(diff>32)x+=(diff-32)*.035;
    if(diff>50)x+=(diff-50)*.055;
    return Math.max(.05,x);
  }

  function goalsFrom(x,diff,fin,keeper){
    let g=Math.floor(x);
    const rem=x-Math.floor(x);
    if(rem+(fin-keeper)*.003>.65)g++;
    if(diff>18&&x>2.0&&rem+(fin-keeper)*.003>.45)g++;
    if(diff>34&&x>3.0)g++;
    if(diff>52&&x>4.2)g++;
    if(x>5.8)g+=Math.floor((x-5.8)*.35);
    if(x>8.0)g+=Math.floor((x-8.0)*.50);
    return Math.max(0,g);
  }

  function dynamicScoreline(aAtk,bAtk,aDef,bDef,aGK,bGK,aSyn,bSyn,momentum){
    const phases=root.__DZ_LAST_PHASES__;
    const A=phases&&phases.PA?phases.PA:null;
    const B=phases&&phases.PB?phases.PB:null;
    const aFin=phases?phases.aFin:weighted([[aAtk,.25],[aDef,.20],[aGK,.15],[aSyn,.15]]);
    const bFin=phases?phases.bFin:weighted([[bAtk,.25],[bDef,.20],[bGK,.15],[bSyn,.15]]);
    const xa=A&&B?xgFor(A,B,aFin,bFin):Math.max(.2,1.1+(aAtk-bDef)*.012);
    const xb=A&&B?xgFor(B,A,bFin,aFin):Math.max(.2,1.1+(bAtk-aDef)*.012);
    const diff=aFin-bFin;
    let ga=goalsFrom(xa,diff,A?A.finishing:aAtk,bGK);
    let gb=goalsFrom(xb,-diff,B?B.finishing:bAtk,aGK);
    if(Math.abs(diff)<6&&xa<2.4&&xb<2.4){ga=Math.min(ga,3);gb=Math.min(gb,3);}
    if(Math.abs(diff)<3&&xa<1.6&&xb<1.6){ga=Math.min(ga,2);gb=Math.min(gb,2);}
    if(diff>24&&ga<4)ga=4;if(diff>38&&ga<6)ga=6;if(diff>58&&ga<8)ga=8;if(diff>38&&gb>2)gb=2;if(diff>54&&gb>1)gb=1;
    if(diff<-24&&gb<4)gb=4;if(diff<-38&&gb<6)gb=6;if(diff<-58&&gb<8)gb=8;if(diff<-38&&ga>2)ga=2;if(diff<-54&&ga>1)ga=1;
    if(aDef>90&&bDef>90&&aAtk<80&&bAtk<80){ga=Math.min(ga,1);gb=Math.min(gb,1);}
    return {xgA:round(xa,2),xgB:round(xb,2),goalsA:ga,goalsB:gb};
  }

  function dynamicPlayerRatings(sqA,sqB,ph){
    root.__DZ_LAST_PHASES__=ph;
    return {rA:ratings(sqA,ph.PA,ph.PB,ph.aFin,ph.bFin,0,0),rB:ratings(sqB,ph.PB,ph.PA,ph.bFin,ph.aFin,0,0)};
  }

  function ratings(sq,A,B,sA,sB,gf,ga){
    const U=units(sq),dom=sA-sB;
    return U.all.map(x=>{
      let rat=6.05+(roleQ(x)-78)*.026+dom*.012;
      if(["st","lw","rw","cam"].includes(x.role))rat+=(A.attack-80)*.013+(A.chanceCreation-80)*.007;
      if(["cm","cdm","cam"].includes(x.role))rat+=(A.midfield-80)*.014+cover(x)*.018;
      if(["cb","lb","rb","cdm","gk"].includes(x.role))rat+=(A.defence-80)*.015+(A.cdmCover-80)*.008;
      return {p:x.p,role:x.role,rat:round(clamp(rat,3.2,10),1)};
    });
  }

  function pickWeighted(items,fn,seed){
    const weights=items.map(x=>Math.max(.01,fn(x))),total=sum(weights);
    let r=((seed*0.381966)%1)*total;
    for(let i=0;i<items.length;i++){r-=weights[i];if(r<=0)return items[i];}
    return items[0];
  }

  function dynamicGoalEvents(sqA,sqB,ph,goalsA,goalsB,n0,n1){
    const events=[];
    addTeamGoals(sqA,0,goalsA,events,n0);
    addTeamGoals(sqB,1,goalsB,events,n1);
    events.sort((a,b)=>a.min-b.min);
    return events;
  }

  function addTeamGoals(sq,team,goals,events,teamName){
    const U=units(sq);
    const scorers=U.forwards.length?U.forwards:U.attackers.length?U.attackers:U.all;
    const assisters=U.mids.concat(U.attackers).length?U.mids.concat(U.attackers):U.all;
    for(let i=0;i<goals;i++){
      const scorer=pickWeighted(scorers,x=>{
        let w=1+attr(x.p,"finishing")*.035+attr(x.p,"poaching")*.025+attr(x.p,"attack")*.015+star(x)*.08;
        if(x.role==="st")w*=1.45;if(x.role==="lw"||x.role==="rw")w*=1.12;
        return w;
      },i+1+team*13);
      const assist=(i%5===0)?null:pickWeighted(assisters.filter(x=>x.p!==scorer.p),x=>{
        let w=1+attr(x.p,"creativity")*.030+attr(x.p,"passing")*.025+attr(x.p,"visionRange")*.020+attr(x.p,"crossing")*.010;
        if(x.role==="cam")w*=1.25;if(x.role==="cm")w*=1.10;if(x.role==="rw"||x.role==="lw")w*=1.08;
        return w;
      },i+3+team*17);
      events.push({min:Math.min(90,8+Math.round(((i+1)/(goals+1))*76)+(team?1:0)),team,scorer:scorer.p,assist:assist?assist.p:null,method:goalMethod(scorer)});
    }
  }

  function goalMethod(x){
    if(x.role==="st")return "box finish";
    if(attr(x.p,"pace")>88)return "transition run";
    if(attr(x.p,"dribbling")>88)return "dribble chance";
    if(attr(x.p,"aerial")>86)return "header";
    return "open play";
  }

  function calcDeepPvP(sqA,sqB,ph,n0,n1){
    const A=ph.PA,B=ph.PB,UA=A.U,UB=B.U;
    const out=[];
    function add(title,aVal,bVal,sub){
      const s=1/(1+Math.exp(-(aVal-bVal)*.14));
      const av=clamp(Math.round(s*100),1,99),bv=100-av;
      out.push({title,sub,a:av,b:bv,dom:{cls:av>65?"p1":bv>65?"p2":"draw",label:av>65?n0+" edge":bv>65?n1+" edge":"Even"},stats:[`<span>${Math.round(aVal)} vs ${Math.round(bVal)}</span>`],narrative:sub});
    }
    const aStar=sortBy(UA.attackers,star)[0],bStop=sortBy(UB.defenders.concat(UB.gk?[UB.gk]:[]),roleQ)[0];
    const bStar=sortBy(UB.attackers,star)[0],aStop=sortBy(UA.defenders.concat(UA.gk?[UA.gk]:[]),roleQ)[0];
    if(aStar&&bStop)add(`${n(aStar.p)} vs ${n(bStop.p)}`,attackVal(aStar)+star(aStar)*.35,roleQ(bStop)+B.cover*.08,"Main attacking threat versus best defensive cover");
    if(bStar&&aStop)add(`${n(bStar.p)} vs ${n(aStop.p)}`,attackVal(bStar)+star(bStar)*.35,roleQ(aStop)+A.cover*.08,"Main attacking threat versus best defensive cover");
    add("Midfield control",A.midfield+A.cover*.05,B.midfield+B.cover*.05,"Tempo, possession and second-ball control");
    add("Transition threat",A.transition,B.transition,"Direct running and vertical passing danger");
    add("Defensive resistance",A.defence+B.attack*.02,B.defence+A.attack*.02,"Back line, CDM screen and goalkeeper resistance");
    return out;
  }

  function attackVal(x){if(!x)return 55;if(x.role==="st")return qST(x);if(x.role==="lw"||x.role==="rw")return qW(x);if(x.role==="cam")return qCAM(x);return roleQ(x);}

  function deepTacticalBreakdown(ph,n0,n1){
    const sections=[];
    function winner(a,b){return Math.abs(a-b)<1.5?["Draw","draw"]:a>b?[n0,"p1"]:[n1,"p2"];}
    [["Attack",ph.aAtk,ph.bAtk],["Midfield",ph.aMid,ph.bMid],["Defence",ph.aDefStr,ph.bDefStr],["Transition",ph.aTrans,ph.bTrans]].forEach(([t,a,b])=>{
      const [wt,wc]=winner(a,b);
      sections.push({title:t,wt,wc,text:`${n0} ${Math.round(a)} vs ${n1} ${Math.round(b)}. These are absolute phase ratings from the selected players, not inflated matchup values.`});
    });
    return sections;
  }

  function contextualWeaknesses(team,opp,tac,oppTac){
    const w=[];
    if(team.defence<76)w.push({label:"Defensive quality below elite level",detail:"Back line/CDM/GK unit can be exposed by strong attackers."});
    if(team.cdmCover<76)w.push({label:"Limited central protection",detail:"Space between midfield and defence may open up."});
    if(team.cbPace<76&&opp.transition>84)w.push({label:"Recovery pace risk",detail:"Fast attacks can threaten balls behind the centre-backs."});
    if(team.aerialDefence<76&&opp.setPieces>84)w.push({label:"Aerial mismatch",detail:"Crosses and set pieces can become dangerous."});
    if(team.pressResistance<76&&opp.pressing>84)w.push({label:"Build-up pressure",detail:"Opponent pressing can force turnovers."});
    return w;
  }

  // Patch exact API used by index.html
  root.ENGINE.calcFullPhases=function(a,b){const ph=calcFullPhases(a,b);root.__DZ_LAST_PHASES__=ph;return ph;};
  root.ENGINE.dynamicScoreline=dynamicScoreline;
  root.ENGINE.dynamicPlayerRatings=dynamicPlayerRatings;
  root.ENGINE.dynamicGoalEvents=dynamicGoalEvents;
  root.ENGINE.calcDeepPvP=calcDeepPvP;
  root.ENGINE.deepTacticalBreakdown=deepTacticalBreakdown;
  root.ENGINE.contextualWeaknesses=contextualWeaknesses;

  // Also expose newer APIs just in case.
  root.ENGINE.indexStableVersion=VERSION;
})();
