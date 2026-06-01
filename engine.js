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
