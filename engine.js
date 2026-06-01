// ═══════════════════════════════════════════════════════════════════════════
//  DRAFT ZONE — DYNAMIC MATCH ENGINE v3.0
//  ~2500 lines of pure football logic
//  Every calculation is contextual, player-interdependent, and dynamic.
// ═══════════════════════════════════════════════════════════════════════════

// ── UTILITY ──────────────────────────────────────────────────────────────────
function avg2(...vals){
  const flat=vals.flat().filter(v=>v!=null&&!isNaN(v));
  return flat.length?flat.reduce((a,b)=>a+b,0)/flat.length:0;
}
function clamp2(v,lo,hi){return Math.max(lo,Math.min(hi,v))}
function rng2(lo,hi){return Math.random()*(hi-lo)+lo}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function weighted(items,wFn){
  const w=items.map(wFn),tot=w.reduce((a,b)=>a+b,0);
  let r=Math.random()*tot;
  for(let i=0;i<items.length;i++){r-=w[i];if(r<=0)return items[i]}
  return items[0];
}
function sname(p){return p?p.name.split("—")[0].trim():"?"}
function firstByRole(sq,role){
  const idx=window.LAYOUT.findIndex(l=>l.role===role&&sq[window.LAYOUT.indexOf(l)]!=null);
  if(idx>=0)return sq[idx];
  for(let i=0;i<window.LAYOUT.length;i++){if(window.LAYOUT[i].role===role&&sq[i])return sq[i]}
  return null;
}
function allByRole(sq,role){return window.LAYOUT.map((l,i)=>l.role===role?sq[i]:null).filter(Boolean)}
function posScore2(p,role){
  if(!p)return 55;
  const PW=window.PW;
  const w=PW[role]||{overall:1};
  let s=0;
  for(const[k,v] of Object.entries(w))s+=(p[k]??p.overall??70)*v;
  return clamp2(Math.round(s),40,99);
}
function attrCol2(v){
  if(v>=88)return"#4ade80";if(v>=78)return"#a3e635";if(v>=66)return"#fbbf24";if(v>=52)return"#f97316";return"#f87171";
}

// ── ATTRIBUTE ACCESSORS WITH DEFAULTS ────────────────────────────────────────
function a(p,k,def=70){return p?p[k]??def:def}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 1: INDIVIDUAL THREAT RATINGS
//  Every player gets a contextual threat rating in each dimension
//  based on their own attributes AND the situation around them.
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

  // ── GK threat contributions ──────────────────────────────
  const gkShotStopping=gk?avg2(a(gk,"goalkeeperRating"),a(gk,"reflexes")):55;
  const gkAerialCommand=gk?avg2(a(gk,"commandOfArea"),a(gk,"aerial")):55;
  const gkDistributionThreat=gk?a(gk,"distribution"):60;
  const gkBigGameFactor=gk?a(gk,"bigGameRating"):70;

  // ── CB partnership quality ───────────────────────────────
  // A CB pair is more than the sum of parts — complementary traits matter
  const cbRaw=cbs.length?avg2(...cbs.map(c=>posScore2(c,"cb"))):55;
  let cbPartnershipBonus=0;
  if(cbs.length>=2){
    // Does one CB have pace and one have aerial? Complementary = bonus
    const maxPace=Math.max(...cbs.map(c=>a(c,"pace")));
    const maxAerial=Math.max(...cbs.map(c=>a(c,"aerial")));
    const minPace=Math.min(...cbs.map(c=>a(c,"pace")));
    if(maxPace>80&&maxAerial>84&&minPace>72)cbPartnershipBonus+=6;
    else if(maxPace>80&&minPace<68)cbPartnershipBonus+=2; // one fast one slow — risky
    // Both intelligent = reads game together
    const bothSmart=cbs.every(c=>a(c,"intelligence")>82);
    if(bothSmart)cbPartnershipBonus+=5;
    // Both leaders = organise well
    if(cbs.every(c=>a(c,"leadership")>80))cbPartnershipBonus+=3;
    // One ball-playing CB improves team build-up
    const hasBPD=cbs.some(c=>(c.traits||[]).includes("ballPlayingDefender"));
    if(hasBPD)cbPartnershipBonus+=3;
  }
  const cbEffectiveness=clamp2(cbRaw+cbPartnershipBonus,40,99);

  // ── CDM — does more than defend ──────────────────────────
  const cdmDefContrib=cdm?posScore2(cdm,"cdm"):50;
  // CDM press resistance affects how much the team can build through the middle
  const cdmPressResistance=cdm?a(cdm,"pressResistance"):60;
  // CDM as screener — protects the CBs
  const cdmScreenQuality=cdm?avg2(a(cdm,"defensiveAwareness"),a(cdm,"positioning"),a(cdm,"tackling")):55;
  // CDM as a ball-winner that starts transitions
  const cdmTransitionLaunch=cdm?avg2(a(cdm,"passing"),a(cdm,"intelligence"),a(cdm,"transitionThreat",60)):55;
  // Does the CDM have enough energy to do the dirty work for the whole team?
  const cdmWorkHorse=cdm?avg2(a(cdm,"workRate"),a(cdm,"stamina"),a(cdm,"pressing")):55;
  // A CDM like Matthaus or Vieira who can also attack
  const cdmAttackContrib=cdm?avg2(a(cdm,"attack",50),a(cdm,"finishing",50),a(cdm,"creativity",50)):45;
  const cdmIsBoxToBox=cdm&&(cdm.traits||[]).some(t=>["boxToBox","goalScoringMidfielder"].includes(t));

  // ── CM — the engine room ─────────────────────────────────
  const cmControlContrib=cm?posScore2(cm,"cm"):55;
  const cmCreativeOutput=cm?avg2(a(cm,"creativity"),a(cm,"passing"),a(cm,"technical")):55;
  const cmPressingContrib=cm?avg2(a(cm,"pressing"),a(cm,"workRate")):55;
  // Does the CM have the intelligence to fill gaps left by attacking FB?
  const cmCoverageIntelligence=cm?a(cm,"intelligence"):70;

  // ── CAM — the spark ──────────────────────────────────────
  const camThreat=cam?posScore2(cam,"cam"):50;
  const camCreativity=cam?a(cam,"creativity"):60;
  const camPressResistance=cam?a(cam,"pressResistance"):60;
  // CAM who drops deep to receive vs one who stays high
  const camDropsDeep=cam&&a(cam,"intelligence")>82&&a(cam,"pressResistance")>78;
  const camSetPieceThreat=cam?a(cam,"setPieces"):60;

  // ── FULLBACK DUAL ROLE ASSESSMENT ────────────────────────
  // Fullbacks have attack AND defence contributions — which mode are they in?
  const lbAttackMode=lb?((lb.traits||[]).includes("attackingFullback")||a(lb,"attack")>72):false;
  const rbAttackMode=rb?((rb.traits||[]).includes("attackingFullback")||a(rb,"attack")>72):false;
  const lbAttackThreat=lb?avg2(a(lb,"pace"),a(lb,"crossing"),a(lb,"attack"),a(lb,"dribbling")):50;
  const rbAttackThreat=rb?avg2(a(rb,"pace"),a(rb,"crossing"),a(rb,"attack"),a(rb,"dribbling")):50;
  const lbDefensiveSecurity=lb?avg2(a(lb,"pace"),a(lb,"defensiveAwareness"),a(lb,"tackling"),a(lb,"intelligence")):55;
  const rbDefensiveSecurity=rb?avg2(a(rb,"pace"),a(rb,"defensiveAwareness"),a(rb,"tackling"),a(rb,"intelligence")):55;
  // Attacking FB creates space for wingers but leaves gaps
  const lbAttackRisk=lbAttackMode?a(lb,"attack",60)*0.8:a(lb,"attack",60)*0.35;
  const rbAttackRisk=rbAttackMode?a(rb,"attack",60)*0.8:a(rb,"attack",60)*0.35;
  const fbCombinedAttackRisk=avg2(lbAttackRisk,rbAttackRisk);

  // ── WINGER THREAT ────────────────────────────────────────
  const lwThreat=lw?posScore2(lw,"lw"):50;
  const rwThreat=rw?posScore2(rw,"rw"):50;
  // Winger pace threat — only counts if there's space to exploit
  const lwSpeedThreat=lw?avg2(a(lw,"pace"),a(lw,"transitionThreat")):50;
  const rwSpeedThreat=rw?avg2(a(rw,"pace"),a(rw,"transitionThreat")):50;
  // Winger crossing quality
  const lwCrossingThreat=lw?avg2(a(lw,"crossing"),a(lw,"creativity")):50;
  const rwCrossingThreat=rw?avg2(a(rw,"crossing"),a(rw,"creativity")):50;
  // Winger cutting inside — how dangerous?
  const lwInsideThreat=lw?avg2(a(lw,"dribbling"),a(lw,"finishing"),a(lw,"creativity")):50;
  const rwInsideThreat=rw?avg2(a(rw,"dribbling"),a(rw,"finishing"),a(rw,"creativity")):50;
  // Does the winger track back?
  const lwDefensiveContrib=lw?avg2(a(lw,"workRate"),a(lw,"pressing"),a(lw,"defensiveAwareness"))*0.6:40;
  const rwDefensiveContrib=rw?avg2(a(rw,"workRate"),a(rw,"pressing"),a(rw,"defensiveAwareness"))*0.6:40;

  // ── STRIKER ──────────────────────────────────────────────
  const stThreat=st?posScore2(st,"st"):50;
  const stFinishingThreat=st?avg2(a(st,"finishing"),a(st,"positioning")):50;
  const stPaceThreat=st?avg2(a(st,"pace"),a(st,"transitionThreat")):50;
  const stAerialThreat=st?avg2(a(st,"aerial"),a(st,"physical")):50;
  const stLinkUpThreat=st?avg2(a(st,"passing"),a(st,"intelligence"),a(st,"creativity"))*0.8:45;
  const stBigGameFactor=st?a(st,"bigGameRating"):70;

  return{
    gk,cbs,lb,rb,cdm,cm,cam,lw,rw,st,all,
    gkShotStopping,gkAerialCommand,gkDistributionThreat,gkBigGameFactor,
    cbEffectiveness,cbRaw,cbPartnershipBonus,
    cbPace:cbs.length?avg2(...cbs.map(c=>a(c,"pace"))):65,
    cbAerial:cbs.length?avg2(...cbs.map(c=>a(c,"aerial"))):70,
    cbDefAware:cbs.length?avg2(...cbs.map(c=>a(c,"defensiveAwareness"))):70,
    cbTackle:cbs.length?avg2(...cbs.map(c=>a(c,"tackling"))):70,
    cbIntelligence:cbs.length?avg2(...cbs.map(c=>a(c,"intelligence"))):70,
    cdmDefContrib,cdmPressResistance,cdmScreenQuality,cdmTransitionLaunch,
    cdmWorkHorse,cdmAttackContrib,cdmIsBoxToBox,
    cmControlContrib,cmCreativeOutput,cmPressingContrib,cmCoverageIntelligence,
    camThreat,camCreativity,camPressResistance,camDropsDeep,camSetPieceThreat,
    lbAttackMode,rbAttackMode,lbAttackThreat,rbAttackThreat,
    lbDefensiveSecurity,rbDefensiveSecurity,
    lbAttackRisk,rbAttackRisk,fbCombinedAttackRisk,
    lwThreat,rwThreat,lwSpeedThreat,rwSpeedThreat,
    lwCrossingThreat,rwCrossingThreat,lwInsideThreat,rwInsideThreat,
    lwDefensiveContrib,rwDefensiveContrib,
    stThreat,stFinishingThreat,stPaceThreat,stAerialThreat,stLinkUpThreat,stBigGameFactor,
    // team-wide aggregates
    teamPace:avg2(...all.map(p=>a(p,"pace"))),
    teamPressing:avg2(...all.map(p=>a(p,"pressing"))),
    teamWorkRate:avg2(...all.map(p=>a(p,"workRate"))),
    teamStamina:avg2(...all.map(p=>a(p,"stamina"))),
    teamIntelligence:avg2(...all.map(p=>a(p,"intelligence"))),
    teamCreativity:avg2(...all.map(p=>a(p,"creativity"))),
    teamPressResistance:avg2(...all.map(p=>a(p,"pressResistance"))),
    teamPhysical:avg2(...all.map(p=>a(p,"physical"))),
    teamTechnical:avg2(...all.map(p=>a(p,"technical"))),
    teamBigGame:avg2(...all.map(p=>a(p,"bigGameRating"))),
    teamConsistency:avg2(...all.map(p=>a(p,"consistency"))),
    gkRating:gk?avg2(a(gk,"goalkeeperRating"),a(gk,"reflexes")):55,
    gkDistrib:gk?a(gk,"distribution"):60,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 2: COVERAGE CHAINS
//  Who is covering for who? If LB attacks, does CDM cover?
//  If ST drops deep, does CM track? Dynamic coverage assessment.
// ═══════════════════════════════════════════════════════════════════════════
function calcCoverageChains(T){
  // ── Can CDM cover for attacking FBs? ─────────────────────
  const cdmCanCoverFBs=T.cdmScreenQuality>72&&T.cdmWorkHorse>70;
  const cdmCoverageEfficiency=cdmCanCoverFBs?clamp2(T.cdmScreenQuality*0.8,40,85):clamp2(T.cdmScreenQuality*0.4,20,60);

  // ── Does CM drop to cover when CDM pushes forward? ───────
  const cmDropsToScreen=T.cmCoverageIntelligence>80&&T.cdmIsBoxToBox;
  const cmScreeningContrib=cmDropsToScreen?T.cmControlContrib*0.65:T.cmControlContrib*0.35;

  // ── FB attack creates space — who covers? ────────────────
  // If LB attacks and CDM can't cover, CB must shift — this weakens centre
  let leftFlankDefGap=0;
  if(T.lbAttackMode){
    if(cdmCanCoverFBs){leftFlankDefGap=clamp2(20-T.cdmScreenQuality*0.2,0,15)}
    else leftFlankDefGap=clamp2((T.lbAttackRisk-50)*0.4,0,25);
  }
  let rightFlankDefGap=0;
  if(T.rbAttackMode){
    if(cdmCanCoverFBs){rightFlankDefGap=clamp2(20-T.cdmScreenQuality*0.2,0,15)}
    else rightFlankDefGap=clamp2((T.rbAttackRisk-50)*0.4,0,25);
  }

  // ── Does a creative CDM (Matthaus/Vieira) compensate for a weaker CAM? ──
  const cdmCompensatesForWeakCAM=T.cdmAttackContrib>65&&T.camThreat<62;
  const effectiveMidfieldCreativity=cdmCompensatesForWeakCAM
    ?avg2(T.camCreativity,T.cdmAttackContrib,T.cmCreativeOutput)*1.1
    :avg2(T.camCreativity,T.cmCreativeOutput)*1.0;

  // ── Does a technical CM compensate for weak press resistance? ────────────
  const cmCompensatesForLowPressRes=T.cmControlContrib>76&&T.teamPressResistance<68;
  const effectivePressResistance=cmCompensatesForLowPressRes
    ?T.teamPressResistance*1.15
    :T.teamPressResistance;

  // ── Wingers not tracking back — who covers? ──────────────
  const lwNotTracking=T.lw&&a(T.lw,"workRate")<65&&a(T.lw,"defensiveAwareness")<60;
  const rwNotTracking=T.rw&&a(T.rw,"workRate")<65&&a(T.rw,"defensiveAwareness")<60;
  const leftExposureFromLW=lwNotTracking?clamp2((80-a(T.lw,"workRate",70))*0.3,0,18):0;
  const rightExposureFromRW=rwNotTracking?clamp2((80-a(T.rw,"workRate",70))*0.3,0,18):0;

  // ── Does attacking CDM leave the back 4 exposed? ─────────
  const cdmPushesHighRisk=T.cdmIsBoxToBox&&T.cdmAttackContrib>68?
    clamp2(T.cdmAttackContrib*0.15,0,14):0;

  // ── Overall team defensive coverage score ────────────────
  const totalDefCoverage=clamp2(
    T.cbEffectiveness*0.35+
    cdmCoverageEfficiency*0.25+
    cmScreeningContrib*0.1+
    T.lbDefensiveSecurity*0.1+
    T.rbDefensiveSecurity*0.1+
    T.gkShotStopping*0.1-
    leftFlankDefGap-rightFlankDefGap-
    leftExposureFromLW-rightExposureFromRW-
    cdmPushesHighRisk,
    25,99
  );

  // ── Overall team attack cohesion ────────────────────────
  const totalAttackCohesion=clamp2(
    T.stThreat*0.28+
    T.lwThreat*0.18+
    T.rwThreat*0.18+
    T.camThreat*0.20+
    effectiveMidfieldCreativity*0.1+
    (T.lbAttackMode?T.lbAttackThreat*0.04:0)+
    (T.rbAttackMode?T.rbAttackThreat*0.04:0),
    25,99
  );

  return{
    cdmCanCoverFBs,cdmCoverageEfficiency,cmDropsToScreen,cmScreeningContrib,
    leftFlankDefGap,rightFlankDefGap,leftExposureFromLW,rightExposureFromRW,
    cdmPushesHighRisk,cdmCompensatesForWeakCAM,effectiveMidfieldCreativity,
    cmCompensatesForLowPressRes,effectivePressResistance,
    totalDefCoverage,totalAttackCohesion,
    lwNotTracking,rwNotTracking
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 3: INDIVIDUAL THREAT NEUTRALISATION
//  When a player is extremely dangerous (Messi, Mbappe, Ronaldo),
//  the engine assesses whether the OPPOSITION has the tools to stop them.
//  This cascades — if 3 players must cover one attacker, who covers the rest?
// ═══════════════════════════════════════════════════════════════════════════
function calcThreatNeutralisation(atkT, defT){
  const results={};

  // ── ST vs CB partnership ─────────────────────────────────
  if(atkT.st){
    const stOverallThreat=avg2(atkT.stFinishingThreat,atkT.stPaceThreat*0.7,atkT.stAerialThreat*0.5,atkT.stBigGameFactor*0.3);
    const cbCounterMeasure=avg2(defT.cbEffectiveness,defT.cdmScreenQuality*0.4);
    const rawAdvantage=stOverallThreat-cbCounterMeasure;
    // Extreme talents (finishing >92) are harder to fully neutralise
    const eliteMultiplier=a(atkT.st,"finishing")>92?1.25:a(atkT.st,"finishing")>86?1.1:1.0;
    const paceIsolationThreat=clamp2((a(atkT.st,"pace")-defT.cbPace)*eliteMultiplier*0.35,0,30);
    const aerialNetAdvantage=clamp2(atkT.stAerialThreat-defT.cbAerial*0.9,-15,25);
    const totalStThreat=clamp2(stOverallThreat*eliteMultiplier+paceIsolationThreat*0.3+aerialNetAdvantage*0.2,20,99);
    const totalCbCounter=clamp2(cbCounterMeasure+defT.gkShotStopping*0.15,30,99);
    results.stVsCb={
      atkScore:totalStThreat,defScore:totalCbCounter,
      advantage:rawAdvantage*eliteMultiplier,
      isElite:eliteMultiplier>1.1,
      paceIsolation:paceIsolationThreat,aerialNet:aerialNetAdvantage
    };
  }

  // ── LW vs RB ─────────────────────────────────────────────
  if(atkT.lw&&defT.rb){
    const lwRawThreat=avg2(a(atkT.lw,"pace"),a(atkT.lw,"dribbling"),a(atkT.lw,"transitionThreat"),a(atkT.lw,"creativity"))*((a(atkT.lw,"pace")>92||a(atkT.lw,"dribbling")>94)?1.2:1.0);
    const rbRawDefence=avg2(a(defT.rb,"pace"),a(defT.rb,"tackling"),a(defT.rb,"defensiveAwareness"),a(defT.rb,"intelligence"));
    // CDM help?
    const cdmHelpsRBSide=defT.cdmScreenQuality>74&&defT.cdmCanCoverFBs;
    const effectiveRBDefence=cdmHelpsRBSide?rbRawDefence+defT.cdmScreenQuality*0.12:rbRawDefence;
    // If LW is an elite dribbler, normal tackling isn't enough
    const dribbleElite=a(atkT.lw,"dribbling")>93;
    const rbTacklingReduction=dribbleElite?effectiveRBDefence*0.85:effectiveRBDefence;
    results.lwVsRb={
      atkScore:clamp2(lwRawThreat,20,99),
      defScore:clamp2(rbTacklingReduction,20,99),
      advantage:lwRawThreat-rbTacklingReduction,
      dribbleElite,cdmHelped:cdmHelpsRBSide
    };
  }

  // ── RW vs LB ─────────────────────────────────────────────
  if(atkT.rw&&defT.lb){
    const rwRawThreat=avg2(a(atkT.rw,"pace"),a(atkT.rw,"dribbling"),a(atkT.rw,"transitionThreat"),a(atkT.rw,"creativity"))*((a(atkT.rw,"pace")>92||a(atkT.rw,"dribbling")>94)?1.2:1.0);
    const lbRawDefence=avg2(a(defT.lb,"pace"),a(defT.lb,"tackling"),a(defT.lb,"defensiveAwareness"),a(defT.lb,"intelligence"));
    const cdmHelpsLBSide=defT.cdmScreenQuality>74&&defT.cdmCanCoverFBs;
    const effectiveLBDefence=cdmHelpsLBSide?lbRawDefence+defT.cdmScreenQuality*0.12:lbRawDefence;
    const dribbleElite=a(atkT.rw,"dribbling")>93;
    const lbTacklingReduction=dribbleElite?effectiveLBDefence*0.85:effectiveLBDefence;
    results.rwVsLb={
      atkScore:clamp2(rwRawThreat,20,99),
      defScore:clamp2(lbTacklingReduction,20,99),
      advantage:rwRawThreat-lbTacklingReduction,
      dribbleElite,cdmHelped:cdmHelpsLBSide
    };
  }

  // ── CAM vs CDM ───────────────────────────────────────────
  if(atkT.cam&&defT.cdm){
    const camRawThreat=avg2(a(atkT.cam,"creativity"),a(atkT.cam,"passing"),a(atkT.cam,"dribbling"),a(atkT.cam,"pressResistance"));
    const cdmRawScreen=avg2(a(defT.cdm,"defensiveAwareness"),a(defT.cdm,"positioning"),a(defT.cdm,"tackling"),a(defT.cdm,"intelligence"));
    // CM can help screen
    const cmAssistsScreen=defT.cmCoverageIntelligence>80&&a(defT.cm,"workRate",70)>72;
    const effectiveScreen=cmAssistsScreen?cdmRawScreen+a(defT.cm,"defensiveAwareness",60)*0.12:cdmRawScreen;
    const isEliteCAM=a(atkT.cam,"creativity")>92||a(atkT.cam,"dribbling")>90;
    const eliteMult=isEliteCAM?1.18:1.0;
    results.camVsCdm={
      atkScore:clamp2(camRawThreat*eliteMult,20,99),
      defScore:clamp2(effectiveScreen,20,99),
      advantage:(camRawThreat*eliteMult)-effectiveScreen,
      isElite:isEliteCAM,cmHelped:cmAssistsScreen
    };
  }

  // ── TRANSITION THREAT — key contextual calculation ────────
  // TRANSITION only activates based on specific defensive conditions
  const highLineRisk=clamp2((100-defT.cbDefAware)/45,.15,.9);
  const fbPushRisk=clamp2((defT.fbCombinedAttackRisk-50)/60,.05,.55);
  const cdmProtectionReduction=clamp2((defT.cdmScreenQuality-65)/35,0,.45);
  const cbPaceReduction=clamp2((defT.cbPace-68)/30,0,.35);
  const teamIntelReduction=clamp2((defT.teamIntelligence-78)/25,0,.3);
  // How threatening are the forwards in transition?
  const fwdTransThreat=avg2(atkT.lwSpeedThreat,atkT.rwSpeedThreat,atkT.stPaceThreat);
  const contextMultiplier=highLineRisk*0.35+fbPushRisk*0.25+(1-cdmProtectionReduction)*0.25+(1-cbPaceReduction)*0.1+(1-teamIntelReduction)*0.05;
  const rawTransThreat=fwdTransThreat*contextMultiplier*1.6;
  // Elite pace (Mbappe 97+, Davies 97) gets extra multiplier
  const elitePaceCount=[atkT.lw,atkT.rw,atkT.st].filter(p=>p&&a(p,"pace")>92).length;
  const elitePaceBonus=elitePaceCount*8;
  results.transition={
    rawThreat:clamp2(rawTransThreat+elitePaceBonus,15,99),
    contextMultiplier,highLineRisk,fbPushRisk,
    cdmProtectionReduction,elitePaceBonus
  };

  // ── PRESSING EFFECTIVENESS ────────────────────────────────
  // Pressing only works if the opponent's press resistance is low
  const pressDiff=atkT.teamPressing-defT.teamPressResistance;
  const pressingEffectiveness=clamp2(50+pressDiff*0.9,15,99);
  // A technical CDM (Busquets, Rodri) makes pressing ineffective
  const techCDMNeutralisesPress=defT.cdmPressResistance>86&&defT.cdm!=null;
  const finalPressingScore=techCDMNeutralisesPress?pressingEffectiveness*0.75:pressingEffectiveness;
  results.pressing={score:finalPressingScore,techCDMNeutralised:techCDMNeutralisesPress};

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 4: DYNAMIC SYNERGY CALCULATOR
//  Synergies between specific player types, traits, and positions.
//  Not just "do they have these traits" but HOW MUCH do they amplify each other.
// ═══════════════════════════════════════════════════════════════════════════
function calcDynamicSynergy(T,sq){
  let synergyScore=0;
  const synergyLog=[];
  const all=T.all;
  const traits=all.flatMap(p=>p.traits||[]);
  const hasTr=t=>traits.includes(t);
  const countTr=t=>traits.filter(x=>x===t).length;
  const ps=all.flatMap(p=>p.playstyles||[]);
  const countP=s=>ps.filter(x=>x===s).length;

  // ── CROSSING + AERIAL TARGET ──────────────────────────────
  const bestCrossing=Math.max(...all.map(p=>a(p,"crossing")));
  const bestAerial=Math.max(...all.map(p=>a(p,"aerial")));
  if(bestCrossing>82&&bestAerial>84){
    const bonus=clamp2(((bestCrossing-80)+(bestAerial-82))*0.25,0,14);
    synergyScore+=bonus;
    if(bonus>6)synergyLog.push(`Elite crossing (${Math.round(bestCrossing)}) + aerial target (${Math.round(bestAerial)}) — dangerous from set pieces and wide delivery`);
  }

  // ── PACE + COUNTER ────────────────────────────────────────
  const paceyFwds=[T.lw,T.rw,T.st].filter(p=>p&&a(p,"pace")>86).length;
  if(paceyFwds>=2&&countP("counterAttack")>=2){
    const bonus=clamp2(paceyFwds*4+countP("counterAttack")*2,0,18);
    synergyScore+=bonus;
    synergyLog.push(`${paceyFwds} pacy forwards + counter-attack playstyle — lightning-fast on the break`);
  } else if(paceyFwds>=1&&countP("counterAttack")>=3){
    synergyScore+=6;
    synergyLog.push("Pace in attack combined with counter-attack identity creates transition danger");
  }

  // ── POSSESSION CONTROL ────────────────────────────────────
  const highPressRes=[T.cdm,T.cm,T.cam].filter(p=>p&&a(p,"pressResistance")>82).length;
  if(highPressRes>=2&&countP("possession")>=3){
    const bonus=clamp2(highPressRes*5+countP("possession")*2,0,20);
    synergyScore+=bonus;
    synergyLog.push(`${highPressRes} midfielders with elite press resistance + possession philosophy — controls the match tempo`);
  }

  // ── HIGH PRESS EFFECTIVENESS ──────────────────────────────
  const highPresserCount=all.filter(p=>a(p,"pressing")>78&&a(p,"workRate")>80).length;
  const highPressStamina=avg2(...all.filter(p=>a(p,"pressing")>78).map(p=>a(p,"stamina")));
  if(highPresserCount>=5&&highPressStamina>78){
    const bonus=clamp2((highPresserCount-4)*4+(highPressStamina-76)*0.3,0,18);
    synergyScore+=bonus;
    synergyLog.push(`${highPresserCount} high-stamina pressers — sustains a full-match press that disrupts any build-up`);
  }

  // ── BOX-TO-BOX CDM COMPENSATES ───────────────────────────
  if(T.cdmIsBoxToBox&&T.cdmAttackContrib>65){
    const bonus=clamp2((T.cdmAttackContrib-60)*0.4,0,12);
    synergyScore+=bonus;
    synergyLog.push(`Box-to-box CDM (${sname(T.cdm)}) contributes both defensively AND in attack — adds an unpredictable dimension`);
  }

  // ── TECHNICAL MIDFIELD TRIANGLE ──────────────────────────
  const techMidPlayers=[T.cdm,T.cm,T.cam].filter(p=>p&&a(p,"technical")>82&&a(p,"pressResistance")>78).length;
  if(techMidPlayers>=2){
    const bonus=techMidPlayers*6;
    synergyScore+=bonus;
    synergyLog.push(`${techMidPlayers}-man technical midfield (pressure resistance ${Math.round(T.teamPressResistance)}) — impossible to press effectively`);
  }

  // ── ATTACKING FULLBACK OVERLOADS ─────────────────────────
  const bothFBsAttack=T.lbAttackMode&&T.rbAttackMode;
  const oneFBAttacks=T.lbAttackMode||T.rbAttackMode;
  if(bothFBsAttack&&T.cdmCanCoverFBs){
    synergyScore+=10;
    synergyLog.push("Both fullbacks attack with CDM cover — creates wide overloads on both flanks simultaneously");
  } else if(bothFBsAttack&&!T.cdmCanCoverFBs){
    synergyScore-=8;
    synergyLog.push("Both fullbacks attack WITHOUT CDM cover — dangerous overload going forward but massive counter-attack vulnerability");
  } else if(oneFBAttacks&&T.cdmCanCoverFBs){
    synergyScore+=5;
    synergyLog.push(`${T.lbAttackMode?sname(T.lb):sname(T.rb)} pushes forward with CDM cover — creates targeted wide overloads`);
  }

  // ── SET PIECE SPECIALISTS ─────────────────────────────────
  const spTaker=all.find(p=>(p.traits||[]).includes("setPieceExpert")&&a(p,"setPieces")>82);
  const spTargets=all.filter(p=>a(p,"aerial")>82).length;
  if(spTaker&&spTargets>=2){
    const bonus=clamp2(a(spTaker,"setPieces")-80+spTargets*3,0,14);
    synergyScore+=bonus;
    synergyLog.push(`Set piece expert ${sname(spTaker)} (${a(spTaker,"setPieces")} SP) with ${spTargets} aerial targets — set pieces are a genuine scoring route`);
  }

  // ── CREATIVE PLAYMAKER + CLINICAL FINISHER ────────────────
  const topCreator=all.reduce((best,p)=>a(p,"creativity")>a(best,"creativity",0)?p:best,{});
  const topFinisher=all.reduce((best,p)=>a(p,"finishing")>a(best,"finishing",0)?p:best,{});
  if(topCreator!==topFinisher&&a(topCreator,"creativity")>86&&a(topFinisher,"finishing")>88){
    const bonus=clamp2(((a(topCreator,"creativity")-84)+(a(topFinisher,"finishing")-86))*0.28,0,14);
    synergyScore+=bonus;
    synergyLog.push(`${sname(topCreator)} (creativity ${a(topCreator,"creativity")}) feeding ${sname(topFinisher)} (finishing ${a(topFinisher,"finishing")}) — elite chance creation to clinical conversion`);
  }

  // ── INTELLIGENT CB PARTNERSHIP ────────────────────────────
  if(T.cbPartnershipBonus>=8){
    synergyScore+=6;
    synergyLog.push("CB partnership synergy — complementary attributes create a more effective unit than either alone");
  }

  // ── BIG GAME MENTALITY ────────────────────────────────────
  const bigGamePlayers=all.filter(p=>a(p,"bigGameRating")>86&&a(p,"consistency")>84).length;
  if(bigGamePlayers>=4){
    const bonus=clamp2((bigGamePlayers-3)*3,0,10);
    synergyScore+=bonus;
    synergyLog.push(`${bigGamePlayers} big-game performers — this team elevates in high-pressure situations`);
  }

  // ── LEADERSHIP SPINE ─────────────────────────────────────
  const leaders=all.filter(p=>a(p,"leadership")>84).length;
  if(leaders>=3){
    synergyScore+=5;
    synergyLog.push(`${leaders} leaders on the pitch — organises the team under pressure, maintains shape when fatigued`);
  }

  // ── WEAK FOOT VERSATILITY ─────────────────────────────────
  const goodWeakFoot=all.filter(p=>a(p,"weakFoot")>80).length;
  if(goodWeakFoot>=6){synergyScore+=4}

  // ── BAD BALANCE PENALTIES ────────────────────────────────
  if(T.fbCombinedAttackRisk>70&&T.cdmScreenQuality<62){
    synergyScore-=10;
    synergyLog.push("⚠️ Attacking fullbacks without defensive midfield cover — chronic counter-attack vulnerability");
  }
  if(T.lwNotTracking&&T.rwNotTracking){
    synergyScore-=8;
    synergyLog.push("⚠️ Both wingers fail to track back — the fullbacks are massively exposed defensively");
  }
  if(!T.cam&&!T.cm){
    synergyScore-=6;
    synergyLog.push("⚠️ No creative presence in midfield — attack relies entirely on wingers and individual brilliance");
  }
  if(a(T.st,"finishing",60)<68&&a(T.st,"pace",70)<72){
    synergyScore-=5;
    synergyLog.push("⚠️ Striker lacks both pace and finishing — unlikely to convert chances created");
  }
  if(T.teamPressResistance<62&&countP("highPress")<2&&T.cbDefAware<70){
    synergyScore-=6;
    synergyLog.push("⚠️ Low press resistance AND weak defensive line — structured pressure from the opposition will be devastating");
  }

  return{
    score:clamp2(65+synergyScore,30,99),
    rawBonus:synergyScore,
    log:synergyLog
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 5: FULL PHASE CALCULATION
//  Uses all individual threats, coverage chains, and neutralisation data
// ═══════════════════════════════════════════════════════════════════════════
function calcFullPhases(sqA,sqB){
  const TA=calcIndividualThreats(sqA);
  const TB=calcIndividualThreats(sqB);
  const CA=calcCoverageChains(TA);
  const CB=calcCoverageChains(TB);
  const neutralAvsB=calcThreatNeutralisation(TA,TB);
  const neutralBvsA=calcThreatNeutralisation(TB,TA);
  const synA=calcDynamicSynergy(TA,sqA);
  const synB=calcDynamicSynergy(TB,sqB);

  // ── ATTACK ───────────────────────────────────────────────
  let aAtk=CA.totalAttackCohesion;
  const stAdvantageA=neutralAvsB.stVsCb?neutralAvsB.stVsCb.advantage:0;
  const lwAdvantageA=neutralAvsB.lwVsRb?neutralAvsB.lwVsRb.advantage:0;
  const rwAdvantageA=neutralAvsB.rwVsLb?neutralAvsB.rwVsLb.advantage:0;
  const camAdvantageA=neutralAvsB.camVsCdm?neutralAvsB.camVsCdm.advantage:0;
  aAtk+=stAdvantageA*0.35+lwAdvantageA*0.22+rwAdvantageA*0.22+camAdvantageA*0.14;
  aAtk-=clamp2(TB.gkShotStopping-74,0,20)*0.10;
  aAtk+=clamp2(synA.rawBonus*0.22,0,16);
  const sqA_local=sqA;
  const eliteAtkA=TA.all.filter(p=>{
    const bestRole=["lw","rw","st","cam"].find(r=>posScore2(p,r)>88);
    return !!bestRole;
  }).length;
  if(eliteAtkA>=2)aAtk+=eliteAtkA*3.5;
  if(eliteAtkA>=3)aAtk+=8;
  aAtk=clamp2(aAtk,28,99);

  let bAtk=CB.totalAttackCohesion;
  const stAdvantageB=neutralBvsA.stVsCb?neutralBvsA.stVsCb.advantage:0;
  const lwAdvantageB=neutralBvsA.lwVsRb?neutralBvsA.lwVsRb.advantage:0;
  const rwAdvantageB=neutralBvsA.rwVsLb?neutralBvsA.rwVsLb.advantage:0;
  const camAdvantageB=neutralBvsA.camVsCdm?neutralBvsA.camVsCdm.advantage:0;
  bAtk+=stAdvantageB*0.35+lwAdvantageB*0.22+rwAdvantageB*0.22+camAdvantageB*0.14;
  bAtk-=clamp2(TA.gkShotStopping-74,0,20)*0.10;
  bAtk+=clamp2(synB.rawBonus*0.22,0,16);
  const eliteAtkB=TB.all.filter(p=>{
    const bestRole=["lw","rw","st","cam"].find(r=>posScore2(p,r)>88);
    return !!bestRole;
  }).length;
  if(eliteAtkB>=2)bAtk+=eliteAtkB*3.5;
  if(eliteAtkB>=3)bAtk+=8;
  bAtk=clamp2(bAtk,28,99);

  // ── MIDFIELD ─────────────────────────────────────────────
  let aMid=avg2(posScore2(TA.cdm,"cdm"),posScore2(TA.cm,"cm"),posScore2(TA.cam,"cam"));
  aMid+=clamp2(CA.effectiveMidfieldCreativity-65,0,15)*0.28;
  aMid+=clamp2(CA.effectivePressResistance-TB.teamPressing,-18,18)*0.32;
  aMid+=clamp2(TA.teamWorkRate-70,0,18)*0.16;
  aMid+=clamp2(TA.teamIntelligence-78,0,18)*0.15;
  aMid+=(TA.teamPhysical-TB.teamPhysical)*0.09;
  const eliteMidA=[TA.cdm,TA.cm,TA.cam].filter(p=>p&&(posScore2(p,"cdm")>86||posScore2(p,"cm")>86||posScore2(p,"cam")>86)).length;
  if(eliteMidA>=2)aMid+=eliteMidA*4;
  aMid=clamp2(aMid,32,99);

  let bMid=avg2(posScore2(TB.cdm,"cdm"),posScore2(TB.cm,"cm"),posScore2(TB.cam,"cam"));
  bMid+=clamp2(CB.effectiveMidfieldCreativity-65,0,15)*0.25;
  bMid+=clamp2(CB.effectivePressResistance-TA.teamPressing,-15,15)*0.3;
  bMid+=clamp2(TB.teamWorkRate-70,0,18)*0.15;
  bMid+=clamp2(TB.teamIntelligence-78,0,15)*0.14;
  bMid+=(TB.teamPhysical-TA.teamPhysical)*0.08;
  bMid=clamp2(bMid,35,99);

  // ── DEFENCE ──────────────────────────────────────────────
  // Defence score must reflect reality — elite CB pair + elite CDM = very hard to beat
  // Average defenders vs elite attackers = goals going in
  let aDefStr=CA.totalDefCoverage;
  if(!TA.cdm)aDefStr-=12; // no CDM is a major structural weakness
  aDefStr-=CA.leftFlankDefGap*0.6+CA.rightFlankDefGap*0.6;
  aDefStr+=clamp2(TA.gkShotStopping-72,0,22)*0.18;
  // Elite CB partnership bonus — Baresi+Cannavaro genuinely impenetrable
  const eliteDefA=TA.cbs.filter(c=>posScore2(c,"cb")>88).length;
  if(eliteDefA>=2)aDefStr+=12; // elite CB pair is a massive bonus
  else if(eliteDefA===1)aDefStr+=5;
  // Weak defenders are punished hard
  const weakDefA=TA.cbs.filter(c=>posScore2(c,"cb")<70).length;
  if(weakDefA>=1)aDefStr-=weakDefA*8;
  // CDM quality amplifies defence significantly
  if(TA.cdm)aDefStr+=clamp2(TA.cdmScreenQuality-65,0,30)*0.35;
  aDefStr=clamp2(aDefStr,20,99);

  let bDefStr=CB.totalDefCoverage;
  if(!TB.cdm)bDefStr-=12;
  bDefStr-=CB.leftFlankDefGap*0.6+CB.rightFlankDefGap*0.6;
  bDefStr+=clamp2(TB.gkShotStopping-72,0,22)*0.18;
  const eliteDefB=TB.cbs.filter(c=>posScore2(c,"cb")>88).length;
  if(eliteDefB>=2)bDefStr+=12;
  else if(eliteDefB===1)bDefStr+=5;
  const weakDefB=TB.cbs.filter(c=>posScore2(c,"cb")<70).length;
  if(weakDefB>=1)bDefStr-=weakDefB*8;
  if(TB.cdm)bDefStr+=clamp2(TB.cdmScreenQuality-65,0,30)*0.35;
  bDefStr=clamp2(bDefStr,20,99);

  // ── TRANSITION ───────────────────────────────────────────
  const aTrans=neutralAvsB.transition?clamp2(neutralAvsB.transition.rawThreat,15,99):45;
  const bTrans=neutralBvsA.transition?clamp2(neutralBvsA.transition.rawThreat,15,99):45;

  // ── WIDE ─────────────────────────────────────────────────
  const lwVsRbA=neutralAvsB.lwVsRb;const rwVsLbA=neutralAvsB.rwVsLb;
  let aWide=avg2(TA.lwThreat,TA.rwThreat)*0.5;
  if(lwVsRbA)aWide+=lwVsRbA.advantage*0.25;
  if(rwVsLbA)aWide+=rwVsLbA.advantage*0.25;
  aWide+=clamp2(TA.lwCrossingThreat+TA.rwCrossingThreat-130,0,20)*0.12;
  if(TA.lbAttackMode)aWide+=TA.lbAttackThreat*0.08;
  if(TA.rbAttackMode)aWide+=TA.rbAttackThreat*0.08;
  aWide=clamp2(aWide,25,99);

  const lwVsRbB=neutralBvsA.lwVsRb;const rwVsLbB=neutralBvsA.rwVsLb;
  let bWide=avg2(TB.lwThreat,TB.rwThreat)*0.5;
  if(lwVsRbB)bWide+=lwVsRbB.advantage*0.25;
  if(rwVsLbB)bWide+=rwVsLbB.advantage*0.25;
  bWide+=clamp2(TB.lwCrossingThreat+TB.rwCrossingThreat-130,0,20)*0.12;
  if(TB.lbAttackMode)bWide+=TB.lbAttackThreat*0.08;
  if(TB.rbAttackMode)bWide+=TB.rbAttackThreat*0.08;
  bWide=clamp2(bWide,25,99);

  // ── PRESSING ─────────────────────────────────────────────
  const aPressScore=neutralAvsB.pressing?neutralAvsB.pressing.score:50;
  const bPressScore=neutralBvsA.pressing?neutralBvsA.pressing.score:50;

  // ── SET PIECES ───────────────────────────────────────────
  const aSP=clamp2(avg2(TA.camSetPieceThreat,avg2(...TA.all.map(p=>a(p,"crossing"))))*0.5+clamp2(TA.stAerialThreat-70,0,20)*0.25-clamp2(TB.cbAerial-72,0,18)*0.2-clamp2(TB.gkAerialCommand-74,0,14)*0.15,42,97);
  const bSP=clamp2(avg2(TB.camSetPieceThreat,avg2(...TB.all.map(p=>a(p,"crossing"))))*0.5+clamp2(TB.stAerialThreat-70,0,20)*0.25-clamp2(TA.cbAerial-72,0,18)*0.2-clamp2(TA.gkAerialCommand-74,0,14)*0.15,42,97);

  // ── GK ───────────────────────────────────────────────────
  const aGK=clamp2(TA.gkRating*1.05,40,99);
  const bGK=clamp2(TB.gkRating*1.05,40,99);

  // ── SYNERGY ──────────────────────────────────────────────
  const aSynScore=synA.score;
  const bSynScore=synB.score;

  // ── FINAL SCORE ──────────────────────────────────────────
  function fin(atk,mid,d,tr,w,sp,pr,syn,gk){
    return atk*.18+mid*.16+d*.16+tr*.12+w*.10+pr*.08+sp*.06+gk*.06+syn*.08;
  }
  const aFin=fin(aAtk,aMid,aDefStr,aTrans,aWide,aSP,aPressScore,aSynScore,aGK);
  const bFin=fin(bAtk,bMid,bDefStr,bTrans,bWide,bSP,bPressScore,bSynScore,bGK);

  return{
    aAtk,bAtk,aMid,bMid,aTrans,bTrans,aWide,bWide,
    aDefStr,bDefStr,aSP,bSP,aPressScore,bPressScore,
    aSynScore,bSynScore,aGK,bGK,aFin,bFin,
    TA,TB,CA,CB,neutralAvsB,neutralBvsA,synA,synB
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 6: DYNAMIC SCORELINE GENERATOR — NO ARTIFICIAL LIMITS
//  A 99-attack team vs a 55-defence genuinely produces 5, 6, 7 goals.
//  A 99-defence team vs a 55-attack genuinely produces 0 or 1.
//  No soft clamping. Scorelines are earned by the numbers.
// ═══════════════════════════════════════════════════════════════════════════
function dynamicScoreline(aAtk,bAtk,aDefStr,bDefStr,aGK,bGK,synA,synB){

  // ── XG FORMULA — brutally honest ─────────────────────────
  // The gap between attack and defence drives goals exponentially
  // A 30-point attack advantage should produce 4-5 goals
  // A 10-point attack advantage should produce 1-2 goals
  // A defensive advantage should produce 0 goals
  function xgCalc(atk,def,gk,syn){
    // Raw dominance: how much does attack exceed defence?
    const dominance=atk-def; // range roughly -60 to +60
    // Convert dominance to XG — exponential scaling for big gaps
    let xg;
    if(dominance>=40)       xg=rng2(3.8,6.5);   // total dominance
    else if(dominance>=28)  xg=rng2(2.8,5.0);
    else if(dominance>=18)  xg=rng2(1.8,3.6);
    else if(dominance>=10)  xg=rng2(1.2,2.8);
    else if(dominance>=3)   xg=rng2(0.7,2.0);
    else if(dominance>=-5)  xg=rng2(0.3,1.4);   // fairly even
    else if(dominance>=-15) xg=rng2(0.1,0.8);
    else if(dominance>=-28) xg=rng2(0.0,0.4);
    else                    xg=rng2(0.0,0.2);   // completely outclassed

    // GK quality reduces conversion — elite GK saves 15-25% of shots
    const gkSaveFactor=clamp2(1.0-(gk-60)/140, 0.72, 1.0);
    xg*=gkSaveFactor;

    // Synergy — a cohesive attack converts more of its chances
    const synBoost=clamp2((syn-65)/100, -0.1, 0.25);
    xg*=(1+synBoost);

    return Math.max(0,xg);
  }

  const xgA=xgCalc(aAtk,bDefStr,bGK,synA);
  const xgB=xgCalc(bAtk,aDefStr,aGK,synB);

  // ── CONVERT XG TO GOALS — Poisson-inspired, no max cap ───
  // XG is already a realistic expected value, so we sample around it
  function sampleGoals(xg){
    if(xg<=0)return 0;
    // Use a weighted random approach that matches football distributions
    // Low XG (0-1): most likely 0 or 1
    // Medium XG (1-2.5): most likely 1 or 2
    // High XG (3-5): most likely 3-4 but can be 6-7 on a great day
    // The raw XG is already our best estimate — add realistic variance
    const spread=Math.sqrt(xg)*0.7; // variance scales with XG
    const raw=xg+rng2(-spread,spread*1.1);
    const goals=Math.max(0,Math.round(raw));
    return goals; // NO CAP — if the engine says 7, it's 7
  }

  const goalsA=sampleGoals(xgA);
  const goalsB=sampleGoals(xgB);

  return{goalsA,goalsB,xgA,xgB};
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 7: DYNAMIC PLAYER RATINGS
//  Based on how their role performed in context, not just raw stats
// ═══════════════════════════════════════════════════════════════════════════
function dynamicPlayerRatings(sqA,sqB,phases){
  const TA=phases.TA,TB=phases.TB;
  const CA=phases.CA,CB=phases.CB;

  function ratePlayer(p,role,myPhases,oppPhases,myTeamT,oppTeamT,myCoverage){
    if(!p)return null;
    const base=posScore2(p,role);
    let r=4.2+((base-40)/59)*5.0;

    // Phase context — strong impact so mismatches show in ratings
    let phaseBoost=0;
    if(["st","lw","rw"].includes(role)){
      phaseBoost=(myPhases.aAtk-oppPhases.bAtk)*0.09;
    } else if(["cdm","cm","cam"].includes(role)){
      phaseBoost=(myPhases.aMid-oppPhases.bMid)*0.08;
    } else if(["cb","lb","rb"].includes(role)){
      // Defenders on outclassed teams should get 4s and 5s
      const atkDiff=myPhases.aDefStr-oppPhases.bAtk;
      phaseBoost=atkDiff*0.075;
    } else if(role==="gk"){
      const underFire=oppPhases.bAtk>myPhases.aDefStr;
      if(underFire){
        // GK can be hero but base is lower since team is under fire
        phaseBoost=(myPhases.aDefStr-oppPhases.bAtk)*0.05+rng2(0,0.7);
      } else {
        phaseBoost=(myPhases.aDefStr-oppPhases.bAtk)*0.04;
      }
    }
    r+=clamp2(phaseBoost,-3.2,3.2);

    // Consistency variance
    const cons=a(p,"consistency")/100;
    r+=rng2(-(1-cons)*1.2,(1-cons)*1.2);

    // Big game
    const bg=a(p,"bigGameRating")/100;
    r+=rng2(-0.25,bg*0.65);

    // Bonuses
    if(role==="cdm"&&myCoverage.cdmCanCoverFBs)r+=0.3;
    if(role==="cm"&&myCoverage.cmDropsToScreen)r+=0.25;
    if(role==="gk"&&oppPhases.bAtk>80)r+=rng2(0,0.55);

    // Hard cap defenders on battered teams
    const atkAdvOpp=(oppPhases.bAtk||50)-(myPhases.aDefStr||50);
    if(atkAdvOpp>25&&["cb","lb","rb"].includes(role))r=Math.min(r,5.6);
    if(atkAdvOpp>40&&["cb","lb","rb"].includes(role))r=Math.min(r,4.8);

    return clamp2(Math.round(r*10)/10,2.8,9.9);
  }

  const phA={aAtk:phases.aAtk,aMid:phases.aMid,aDefStr:phases.aDefStr};
  const phB={aAtk:phases.bAtk,aMid:phases.bMid,aDefStr:phases.bDefStr};
  const phAOpp={bAtk:phases.bAtk,bMid:phases.bMid,bDefStr:phases.bDefStr};
  const phBOpp={bAtk:phases.aAtk,bMid:phases.aMid,bDefStr:phases.aDefStr};

  const rA=sqA.map((p,i)=>{
    if(!p)return null;
    const role=window.LAYOUT[i].role;
    return{p,role,rat:ratePlayer(p,role,phA,phAOpp,TA,TB,CA)};
  }).filter(Boolean);

  const rB=sqB.map((p,i)=>{
    if(!p)return null;
    const role=window.LAYOUT[i].role;
    return{p,role,rat:ratePlayer(p,role,phB,phBOpp,TB,TA,CB)};
  }).filter(Boolean);

  return{rA,rB};
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 8: DYNAMIC GOAL EVENT GENERATOR
//  Goals reflect the match context — pace goals, set pieces, clinical finishes
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

  // Weight scorer selection by actual goal threat
  function pickScorer(sq,T){
    const opts=[T.st,T.lw,T.rw,T.cam].filter(Boolean);
    if(!opts.length)return sq.filter(Boolean)[0];
    return weighted(opts,p=>(a(p,"finishing")*1.2+a(p,"positioning")+a(p,"attack"))*clamp2(a(p,"bigGameRating")/85,0.7,1.4));
  }
  function pickAssist(sq,T,scorer){
    const opts=[T.cam,T.cm,T.lb,T.rb,T.lw,T.rw].filter(p=>p&&p!==scorer);
    if(!opts.length)return null;
    return weighted(opts,p=>a(p,"passing")*0.8+a(p,"crossing")*0.6+a(p,"creativity")*0.6);
  }

  function goalMethod(scorer,T){
    const p=scorer;
    if(!p)return"Finish";
    const paceOpt=a(p,"pace")>88&&phases.neutralAvsB?.transition?.contextMultiplier>0.4;
    const aerialOpt=a(p,"aerial")>82&&Math.random()<0.3;
    const counterOpt=paceOpt&&Math.random()<0.45;
    const spOpt=(T.camSetPieceThreat>78||a(p,"setPieces")>82)&&a(p,"aerial")>80&&Math.random()<0.25;
    if(spOpt)return"Set piece header";
    if(counterOpt)return"Counter-attack";
    if(aerialOpt)return"Header";
    if(a(p,"dribbling")>88&&Math.random()<0.3)return"Individual brilliance";
    return"Finish";
  }

  for(let i=0;i<goalsA;i++){
    const sc=pickScorer(sqA,TA);
    const as=pickAssist(sqA,TA,sc);
    const min=uMin(12+i*18,14);
    events.push({min,team:0,scorer:sc,assist:as,method:goalMethod(sc,TA)});
  }
  for(let i=0;i<goalsB;i++){
    const sc=pickScorer(sqB,TB);
    const as=pickAssist(sqB,TB,sc);
    const min=uMin(20+i*18,14);
    events.push({min,team:1,scorer:sc,assist:as,method:goalMethod(sc,TB)});
  }
  return events.sort((a,b)=>a.min-b.min);
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 9: DEEP PLAYER VS PLAYER BATTLES
//  9+ matchups with extreme scores, full narrative, stat boxes
// ═══════════════════════════════════════════════════════════════════════════
function calcDeepPvP(sqA,sqB,phases,n0,n1){
  const TA=phases.TA,TB=phases.TB;
  const CA=phases.CA,CB=phases.CB;
  const battles=[];

  function bScores(diff){
    // No artificial floor — truly dominant can produce 95-5 or 97-3
    const raw=50+diff*1.35;
    const aS=clamp2(Math.round(raw),2,98);
    return{a:aS,b:100-aS};
  }

  function domLabel(a,b,nameA,nameB){
    const d=a-b;
    if(d>60)return{label:`${nameA} TOTAL DOMINANCE`,cls:"p1"};
    if(d>44)return{label:`${nameA} DOMINATES`,cls:"p1"};
    if(d>28)return{label:`${nameA} WINS CLEARLY`,cls:"p2"? "p1":"p1",cls:"p1"};
    if(d>14)return{label:`${nameA} EDGES IT`,cls:"p1"};
    if(d>5)return{label:`${nameA} NARROW WIN`,cls:"p1"};
    if(d>-6)return{label:"EVEN BATTLE",cls:"draw"};
    if(d>-15)return{label:`${nameB} NARROW WIN`,cls:"p2"};
    if(d>-29)return{label:`${nameB} EDGES IT`,cls:"p2"};
    if(d>-45)return{label:`${nameB} WINS CLEARLY`,cls:"p2"};
    if(d>-61)return{label:`${nameB} DOMINATES`,cls:"p2"};
    return{label:`${nameB} TOTAL DOMINANCE`,cls:"p2"};
  }

  function statBox(lbl,v1,v2){
    const col1=attrCol2(v1),col2=attrCol2(v2);
    return`<div class="pvp-stat-box"><div class="pvp-stat-val" style="color:${col1}">${v1}<span style="color:var(--muted);font-size:10px"> v </span><span style="color:${col2}">${v2}</span></div><div class="pvp-stat-lbl">${lbl}</div></div>`;
  }

  // ── BATTLE 1: ST vs CB partnership ───────────────────────
  if(TA.st&&TB.cbs.length){
    const n=phases.neutralAvsB.stVsCb;
    const stPow=n?n.atkScore:posScore2(TA.st,"st");
    const defPow=n?n.defScore:TB.cbEffectiveness;
    const diff=stPow-defPow;
    const{a,b}=bScores(diff);
    const dom=domLabel(a,b,sname(TA.st),TB.cbs.map(c=>sname(c)).join("/"));

    // Build deep narrative
    let txt=`<strong>${sname(TA.st)}</strong> lines up against <strong>${TB.cbs.map(c=>sname(c)).join(" & ")}</strong>. `;
    const stFin=window.a(TA.st,"finishing"),stPace2=window.a(TA.st,"pace");
    const cbPaceAvg=TB.cbPace,cbDA=TB.cbDefAware,cbAerial=TB.cbAerial;
    const cbPartBonus=TB.cbPartnershipBonus;

    if(stFin>=95)txt+=`${sname(TA.st)}'s finishing (${stFin}) is arguably the greatest of any player in this draft — every shot is a genuine threat and even the slightest opening becomes a goal. `;
    else if(stFin>=90)txt+=`Elite finishing quality (${stFin}) means ${sname(TA.st)} converts chances that others would waste. `;
    else if(stFin>=84)txt+=`Good finishing (${stFin}) — clinical in front of goal most of the time. `;
    else txt+=`Finishing of ${stFin} means ${sname(TA.st)} may struggle to convert under pressure — defenders can afford a slight error. `;

    const paceDiff=stPace2-cbPaceAvg;
    if(paceDiff>18)txt+=`<br><br>The pace gap of <strong>${Math.round(paceDiff)} points</strong> is catastrophic for the defence. When ${sname(TA.st)} runs in behind, there is simply no recovery — it is a footrace that cannot be won. ${n&&n.isElite?"The elite multiplier of this forward makes an already serious pace gap even more devastating.":""} `;
    else if(paceDiff>8)txt+=`<br><br>A meaningful pace advantage of ${Math.round(paceDiff)} points — ${sname(TA.st)} can get in behind with well-timed runs and the CBs struggle to recover. `;
    else if(paceDiff<-10)txt+=`<br><br>The centre-backs win the pace battle comfortably (${Math.round(Math.abs(paceDiff))} points faster) — any attempt to run in behind is snuffed out before it becomes dangerous. `;
    else txt+=`<br><br>Pace is evenly matched — this is primarily decided by positioning, intelligence and physicality. `;

    if(cbDA>=90)txt+=`Defensive awareness of <strong>${Math.round(cbDA)}</strong> means the back line reads danger before it develops — ${sname(TA.st)}'s runs are tracked from their inception and supply is cut off early. `;
    else if(cbDA<70)txt+=`Defensive awareness of only ${Math.round(cbDA)} is a serious weakness — ${sname(TA.st)} reads where the gaps will be and exploits them ruthlessly. `;
    if(cbAerial-window.a(TA.st,"aerial",70)>14)txt+=`Aerially, the centre-backs are dominant (${Math.round(cbAerial)} vs ${window.a(TA.st,"aerial",70)}) — set pieces and crosses are well defended. `;
    else if(window.a(TA.st,"aerial",70)-cbAerial>12)txt+=`${sname(TA.st)} wins the aerial battle decisively (${window.a(TA.st,"aerial",70)} vs ${Math.round(cbAerial)}) — crosses and corners become a genuine scoring threat. `;
    if(cbPartBonus>=8)txt+=`The CB partnership works brilliantly together — complementary attributes mean one covers what the other lacks. `;
    else if(cbPartBonus<=0&&TB.cbs.length>=2)txt+=`The centre-back partnership isn't particularly complementary — gaps can appear between them when stretched. `;

    if(diff>35)txt+=`<br><br><strong>Verdict:</strong> This is a mismatch of the highest order. ${sname(TA.st)} is simply too good for this defensive pairing and should score multiple goals from this tie alone.`;
    else if(diff>18)txt+=`<br><br><strong>Verdict:</strong> A clear advantage for the striker. The CBs will be under severe and sustained pressure throughout the match.`;
    else if(diff>5)txt+=`<br><br><strong>Verdict:</strong> The striker edges this but the defenders can make it uncomfortable — expect a contested individual duel.`;
    else if(diff>-6)txt+=`<br><br><strong>Verdict:</strong> A genuine battle with neither player dominating. Quality on both sides.`;
    else if(diff>-20)txt+=`<br><br><strong>Verdict:</strong> The CB pairing edges it — ${sname(TA.st)} is contained for most of the match.`;
    else txt+=`<br><br><strong>Verdict:</strong> Defensive masterclass. ${TB.cbs.map(c=>sname(c)).join(" & ")} completely neutralise the striker threat and keep a clean sheet.`;

    battles.push({title:`${sname(TA.st)} vs ${TB.cbs.map(c=>sname(c)).join(" & ")}`,sub:"STRIKER vs CENTRE-BACK(S)",a,b,dom,narrative:txt,
      stats:[statBox("FINISHING",window.a(TA.st,"finishing"),Math.round(avg2(...TB.cbs.map(c=>window.a(c,"tackling"))))),
             statBox("PACE",stPace2,Math.round(cbPaceAvg)),
             statBox("AERIAL",window.a(TA.st,"aerial"),Math.round(cbAerial)),
             statBox("BIG GAME",window.a(TA.st,"bigGameRating"),Math.round(avg2(...TB.cbs.map(c=>window.a(c,"bigGameRating")))))]});
  }

  // ── BATTLE 2: LW vs RB ───────────────────────────────────
  if(TA.lw&&TB.rb){
    const n=phases.neutralAvsB.lwVsRb;
    const lwPow=n?n.atkScore:TA.lwThreat;
    const rbPow=n?n.defScore:posScore2(TB.rb,"rb");
    const diff=lwPow-rbPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.lw),sname(TB.rb));
    const paceDiff=window.a(TA.lw,"pace")-window.a(TB.rb,"pace");
    const dribblingAdv=window.a(TA.lw,"dribbling")-window.a(TB.rb,"tackling");
    const rbAtk=(TB.rb.traits||[]).includes("attackingFullback");
    const cdmHelped=n&&n.cdmHelped;

    let txt=`<strong>${sname(TA.lw)}</strong> against <strong>${sname(TB.rb)}</strong> on the left flank — a critical individual duel.<br><br>`;
    if(window.a(TA.lw,"pace")>93)txt+=`${sname(TA.lw)}'s pace (${window.a(TA.lw,"pace")}) is in the top tier of the game. At this level of speed, conventional defending simply doesn't work — the right back needs defensive intelligence and positioning to compensate, not just pace of their own. `;
    if(window.a(TA.lw,"dribbling")>93)txt+=`A dribbling rating of <strong>${window.a(TA.lw,"dribbling")}</strong> makes ${sname(TA.lw)} almost unplayable in one-on-one situations. Even when the right back sets up correctly, the winger has the technical ability to go past them. `;
    if(paceDiff>14)txt+=`The raw pace advantage of ${Math.round(paceDiff)} points means the right back is regularly beaten to the ball in recovery situations. `;
    else if(paceDiff<-8)txt+=`${sname(TB.rb)} is actually faster — the pace card that usually works for wingers doesn't apply here. `;
    if(dribblingAdv>14)txt+=`Dribbling vs tackling: ${window.a(TA.lw,"dribbling")} vs ${window.a(TB.rb,"tackling")} — a massive advantage in 1v1 duels. `;
    if(rbAtk)txt+=`${sname(TB.rb)} is an attacking fullback who pushes high — this creates space behind him that ${sname(TA.lw)} can exploit on the transition. When ${n1} lose possession, ${sname(TA.lw)} has metres of space to run into. `;
    if(cdmHelped)txt+=`${n1}'s CDM (${sname(TB.cdm)}) does provide some cover — dropping into the channel to help ${sname(TB.rb)} when ${sname(TA.lw)} has the ball. But it costs them defensive coverage elsewhere. `;
    if(window.a(TB.rb,"intelligence")>=86)txt+=`${sname(TB.rb)}'s intelligence (${window.a(TB.rb,"intelligence")}) allows him to read ${sname(TA.lw)}'s runs and position himself to cut off options before the winger receives. `;
    if(diff>30)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.lw)} completely owns this flank. ${sname(TB.rb)} is out of his depth and ${n0} will attack down the left side relentlessly.`;
    else if(diff>12)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.lw)} wins this battle clearly — the left flank is ${n0}'s primary route to goal.`;
    else if(diff>-6)txt+=`<br><br><strong>Verdict:</strong> An evenly contested flank. Both players trade blows throughout.`;
    else txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.rb)} shuts down the left flank — ${sname(TA.lw)} has little impact and ${n0} are forced to find other routes.`;

    battles.push({title:`${sname(TA.lw)} vs ${sname(TB.rb)}`,sub:"LEFT WING vs RIGHT BACK",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PACE",window.a(TA.lw,"pace"),window.a(TB.rb,"pace")),
             statBox("DRIBBLING",window.a(TA.lw,"dribbling"),window.a(TB.rb,"tackling")),
             statBox("CREATIVITY",window.a(TA.lw,"creativity"),window.a(TB.rb,"intelligence")),
             statBox("TRANS THREAT",window.a(TA.lw,"transitionThreat"),window.a(TB.rb,"defensiveAwareness"))]});
  }

  // ── BATTLE 3: RW vs LB ───────────────────────────────────
  if(TA.rw&&TB.lb){
    const n=phases.neutralAvsB.rwVsLb;
    const rwPow=n?n.atkScore:TA.rwThreat;
    const lbPow=n?n.defScore:posScore2(TB.lb,"lb");
    const diff=rwPow-lbPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.rw),sname(TB.lb));
    let txt=`<strong>${sname(TA.rw)}</strong> against <strong>${sname(TB.lb)}</strong> on the right flank.<br><br>`;
    const paceDiff=window.a(TA.rw,"pace")-window.a(TB.lb,"pace");
    if(window.a(TA.rw,"crossing")>88)txt+=`${sname(TA.rw)}'s crossing (${window.a(TA.rw,"crossing")}) means every time he reaches the byline it's a dangerous delivery — corners and crosses from this side are a constant threat. `;
    if(paceDiff>14)txt+=`The pace gap (${window.a(TA.rw,"pace")} vs ${window.a(TB.lb,"pace")}) means ${sname(TA.rw)} repeatedly escapes down the right channel and can pull away with the ball. `;
    else if(paceDiff<-8)txt+=`${sname(TB.lb)} is quick enough to track ${sname(TA.rw)}'s runs — the pace weapon is neutralised. `;
    if(window.a(TB.lb,"pressing")>84)txt+=`${sname(TB.lb)}'s pressing (${window.a(TB.lb,"pressing")}) is intense — ${sname(TA.rw)} rarely has time to pick his head up and assess options. `;
    if((TB.lb.traits||[]).includes("attackingFullback"))txt+=`${sname(TB.lb)} attacks — this creates overlapping situations on the left but leaves the channel open behind him when ${n0} counter. `;
    if(diff>30)txt+=`<br><br><strong>Verdict:</strong> Dominant performance from ${sname(TA.rw)} — the right side is unstoppable.`;
    else if(diff<-20)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.lb)} is exceptional here — ${sname(TA.rw)} has no impact on the game.`;
    else txt+=`<br><br><strong>Verdict:</strong> A well-contested flank. This battle could go either way depending on in-game moments.`;

    battles.push({title:`${sname(TA.rw)} vs ${sname(TB.lb)}`,sub:"RIGHT WING vs LEFT BACK",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PACE",window.a(TA.rw,"pace"),window.a(TB.lb,"pace")),
             statBox("DRIBBLING",window.a(TA.rw,"dribbling"),window.a(TB.lb,"tackling")),
             statBox("CROSSING",window.a(TA.rw,"crossing"),window.a(TB.lb,"defensiveAwareness")),
             statBox("STAMINA",window.a(TA.rw,"stamina"),window.a(TB.lb,"stamina"))]});
  }

  // ── BATTLE 4: CDM vs CAM ─────────────────────────────────
  if(TA.cdm&&TB.cam){
    const n=phases.neutralAvsB.camVsCdm;
    const camPow=n?n.atkScore:posScore2(TB.cam,"cam");
    const cdmPow=n?n.defScore:posScore2(TA.cdm,"cdm");
    const diff=cdmPow-camPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.cdm),sname(TB.cam));
    const cdmDA=window.a(TA.cdm,"defensiveAwareness"),camCre=window.a(TB.cam,"creativity");
    let txt=`<strong>${sname(TA.cdm)}</strong> tasked with neutralising <strong>${sname(TB.cam)}</strong> — the CDM screen versus the creative spark.<br><br>`;
    if(cdmDA>=90)txt+=`${sname(TA.cdm)}'s defensive awareness (${cdmDA}) is at the elite level — he reads passes before they happen and consistently positions himself to cut off the supply to ${sname(TB.cam)}. Even when ${sname(TB.cam)} finds space, ${sname(TA.cdm)} closes it within seconds. `;
    if(camCre>=94)txt+=`${sname(TB.cam)}'s creativity (${camCre}) borders on the supernatural — finding passes and angles that should simply not exist. A CDM with anything less than elite defensive awareness will simply not be able to keep up with the options ${sname(TB.cam)} sees. `;
    if(window.a(TA.cdm,"tackling")>=90)txt+=`Elite tackling (${window.a(TA.cdm,"tackling")}) means that even when ${sname(TB.cam)} receives the ball, ${sname(TA.cdm)} can win it back cleanly and immediately. `;
    if(window.a(TB.cam,"pressResistance")>=88)txt+=`${sname(TB.cam)}'s press resistance (${window.a(TB.cam,"pressResistance")}) means standard pressing doesn't work — he keeps the ball under intense pressure and picks his moment to release. `;
    if(window.a(TA.cdm,"passing")>=86)txt+=`${sname(TA.cdm)}'s passing (${window.a(TA.cdm,"passing")}) means that when he wins the ball, he doesn't just clear it — he launches attacks with quality distribution. `;
    if(n&&n.cmHelped)txt+=`${n0}'s CM (${sname(TA.cm)}) drops into the screen to help ${sname(TA.cdm)} — double coverage reduces ${sname(TB.cam)}'s space significantly. `;
    if(TA.cdmIsBoxToBox)txt+=`${sname(TA.cdm)} isn't just a destroyer — as a box-to-box player he can counter-attack immediately after winning possession, creating a transition threat of his own. `;
    if(diff>25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.cdm)} dominates this battle — ${sname(TB.cam)}'s creative influence is minimal and ${n1} cannot create chances through the middle.`;
    else if(diff<-25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.cam)} is exceptional — he bypasses ${sname(TA.cdm)} repeatedly and creates goal after goal.`;
    else txt+=`<br><br><strong>Verdict:</strong> A fascinating chess match. Both players have moments of supremacy in a balanced central battle.`;

    battles.push({title:`${sname(TA.cdm)} screens vs ${sname(TB.cam)}`,sub:"CDM SCREEN vs CAM CREATIVITY",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("DEF AWARE",cdmDA,camCre),
             statBox("TACKLING",window.a(TA.cdm,"tackling"),window.a(TB.cam,"dribbling")),
             statBox("PRESS RES",window.a(TA.cdm,"pressResistance"),window.a(TB.cam,"pressResistance")),
             statBox("PASSING",window.a(TA.cdm,"passing"),window.a(TB.cam,"passing"))]});
  }

  // ── BATTLE 5: CM vs CM ───────────────────────────────────
  if(TA.cm&&TB.cm){
    const cmAPow=posScore2(TA.cm,"cm"),cmBPow=posScore2(TB.cm,"cm");
    const diff=cmAPow-cmBPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.cm),sname(TB.cm));
    let txt=`<strong>${sname(TA.cm)}</strong> vs <strong>${sname(TB.cm)}</strong> — the battle for control in the engine room.<br><br>`;
    const passA=window.a(TA.cm,"passing"),passB=window.a(TB.cm,"passing");
    const prA=window.a(TA.cm,"pressResistance"),prB=window.a(TB.cm,"pressResistance");
    const stA=window.a(TA.cm,"stamina"),stB=window.a(TB.cm,"stamina");
    if(passA>=92)txt+=`${sname(TA.cm)}'s passing (${passA}) is world class — ranging 50-60 metre switches, incisive through balls, and reliable short combinations all come naturally. `;
    if(passB>=92)txt+=`${sname(TB.cm)} is equally adept in passing (${passB}) — the duel for midfield control becomes a passing masterclass from both sides. `;
    if(prA>=88)txt+=`${sname(TA.cm)}'s press resistance (${prA}) makes him almost impossible to press effectively — he always finds the pass under maximum pressure. `;
    if(prB>=88)txt+=`${sname(TB.cm)} matches or exceeds this in press resistance (${prB}) — this midfield battle is operating at the highest technical level. `;
    const staminaDiff=stA-stB;
    if(Math.abs(staminaDiff)>14)txt+=`Stamina becomes crucial in the second half — ${staminaDiff>0?`${sname(TA.cm)} maintains his level when ${sname(TB.cm)} begins to fade`:`${sname(TB.cm)} is stronger in the closing stages`}. `;
    if(window.a(TA.cm,"intelligence")>=94)txt+=`${sname(TA.cm)}'s football intelligence (${window.a(TA.cm,"intelligence")}) is generational — he anticipates play multiple moves ahead and is always in the optimal position. `;
    if(CA.cdmCompensatesForWeakCAM)txt+=`${sname(TA.cdm)} assists ${sname(TA.cm)} creatively — the CDM's attack contribution compensates for any limitations in the CM. `;
    if(diff>25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.cm)} controls the central zone throughout. ${sname(TB.cm)} can barely compete.`;
    else if(diff<-25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.cm)} dominates midfield — ${sname(TA.cm)} is chasing the game and losing possession.`;
    else txt+=`<br><br><strong>Verdict:</strong> An excellent battle decided by small margins over 90 minutes.`;

    battles.push({title:`${sname(TA.cm)} vs ${sname(TB.cm)}`,sub:"CENTRAL MIDFIELD ENGINE",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PASSING",passA,passB),statBox("PRESS RES",prA,prB),statBox("STAMINA",stA,stB),statBox("INTELLIGENCE",window.a(TA.cm,"intelligence"),window.a(TB.cm,"intelligence"))]});
  }

  // ── BATTLE 6: GK vs GK ───────────────────────────────────
  if(TA.gk&&TB.gk){
    const gkAPow=posScore2(TA.gk,"gk"),gkBPow=posScore2(TB.gk,"gk");
    const diff=gkAPow-gkBPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TA.gk),sname(TB.gk));
    let txt=`<strong>${sname(TA.gk)}</strong> vs <strong>${sname(TB.gk)}</strong>.<br><br>`;
    if(window.a(TA.gk,"reflexes")>=92)txt+=`${sname(TA.gk)}'s reflexes (${window.a(TA.gk,"reflexes")}) are borderline supernatural — he stops shots that would beat 99% of goalkeepers. `;
    if(window.a(TB.gk,"reflexes")>=92)txt+=`${sname(TB.gk)} matches that level (${window.a(TB.gk,"reflexes")}) — two elite reflexes keepers facing each other means the scoreline will likely be determined by other factors. `;
    if(window.a(TA.gk,"commandOfArea")>=90)txt+=`${sname(TA.gk)}'s command of area (${window.a(TA.gk,"commandOfArea")}) dominates his box — crosses and corners are claimed authoritatively, cutting off the aerial threat. `;
    if(window.a(TA.gk,"distribution")>=88)txt+=`${sname(TA.gk)}'s distribution (${window.a(TA.gk,"distribution")}) turns saves into attacks instantly — he's as important in build-up play as he is between the sticks. `;
    if(diff>25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.gk)} is clearly the superior keeper and will make saves that keep ${n0} in the match when under pressure.`;
    else if(diff<-25)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.gk)} is the standout goalkeeper — crucial saves at key moments could swing the entire match.`;
    else txt+=`<br><br><strong>Verdict:</strong> Both are excellent keepers — the match will probably be decided by outfield play rather than goalkeeping.`;

    battles.push({title:`${sname(TA.gk)} vs ${sname(TB.gk)}`,sub:"GOALKEEPER DUEL",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("REFLEXES",window.a(TA.gk,"reflexes"),window.a(TB.gk,"reflexes")),
             statBox("COMMAND",window.a(TA.gk,"commandOfArea"),window.a(TB.gk,"commandOfArea")),
             statBox("DISTRIBUTION",window.a(TA.gk,"distribution"),window.a(TB.gk,"distribution")),
             statBox("BIG GAME",window.a(TA.gk,"bigGameRating"),window.a(TB.gk,"bigGameRating"))]});
  }

  // ── BATTLE 7: CB vs wide threat cutting inside ────────────
  const cbA=TB.cbs[0],wideB=TA.lw||TA.rw;
  if(cbA&&wideB){
    const cbPow=posScore2(cbA,"cb"),widePow=posScore2(wideB,TA.lw?"lw":"rw");
    const diff=cbPow-widePow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(cbA),sname(wideB));
    const paceDiff=window.a(cbA,"pace")-window.a(wideB,"pace");
    let txt=`<strong>${sname(cbA)}</strong> defending against <strong>${sname(wideB)}</strong> when cutting inside — a direct individual contest.<br><br>`;
    if(paceDiff<-18)txt+=`The pace mismatch is severe — ${sname(wideB)} is ${Math.abs(Math.round(paceDiff))} points faster. When ${sname(wideB)} receives the ball in space and turns to face the goal, ${sname(cbA)} simply cannot recover the ground. `;
    else if(paceDiff<-8)txt+=`${sname(wideB)} has a significant pace advantage (${Math.abs(Math.round(paceDiff))} points) — ${sname(cbA)} must rely on positioning to avoid being isolated. `;
    else if(paceDiff>6)txt+=`${sname(cbA)} is actually quick enough to match ${sname(wideB)} — the pace card doesn't work here. `;
    if(window.a(wideB,"dribbling")>93)txt+=`A dribbling rating of ${window.a(wideB,"dribbling")} means even a well-positioned ${sname(cbA)} can be beaten in one-on-one situations — the technique and close control is simply too high. `;
    if(window.a(cbA,"intelligence")>=88)txt+=`${sname(cbA)}'s intelligence (${window.a(cbA,"intelligence")}) means he positions to cut off the inside run before it starts — denying ${sname(wideB)} the space that would make their advantage count. `;
    if(diff<-25)txt+=`<br><br><strong>Verdict:</strong> This is a crisis for ${n0}'s defence every time ${sname(wideB)} gets on the ball in their half.`;
    else if(diff>20)txt+=`<br><br><strong>Verdict:</strong> ${sname(cbA)} reads the winger's movement brilliantly and cuts off the inside threat effectively.`;
    else txt+=`<br><br><strong>Verdict:</strong> Contested battle — the outcome often depends on specific moments and match situations.`;

    battles.push({title:`${sname(cbA)} vs ${sname(wideB)} (inside cut)`,sub:"CB DEFENDING vs WIDE THREAT",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PACE",window.a(cbA,"pace"),window.a(wideB,"pace")),
             statBox("DEF AWARE",window.a(cbA,"defensiveAwareness"),window.a(wideB,"dribbling")),
             statBox("AERIAL",window.a(cbA,"aerial"),window.a(wideB,"aerial")),
             statBox("INTELLIGENCE",window.a(cbA,"intelligence"),window.a(wideB,"intelligence"))]});
  }

  // ── BATTLE 8: CDM vs ST link-up ──────────────────────────
  if(TB.cdm&&TA.st){
    const cdmPow=posScore2(TB.cdm,"cdm");
    const stLinkPow=avg2(window.a(TA.st,"passing"),window.a(TA.st,"intelligence"),window.a(TA.st,"physical"),window.a(TA.st,"positioning"));
    const diff=cdmPow-stLinkPow;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(TB.cdm),sname(TA.st));
    let txt=`<strong>${sname(TB.cdm)}</strong> trying to cut off service to <strong>${sname(TA.st)}</strong> — CDM vs striker in the link-up zone.<br><br>`;
    if(window.a(TB.cdm,"tackling")>=90)txt+=`Elite tackling (${window.a(TB.cdm,"tackling")}) — ${sname(TB.cdm)} wins the ball cleanly every time ${sname(TA.st)} tries to hold up play and turn. `;
    if(window.a(TB.cdm,"physical")>=88)txt+=`Physical dominance (${window.a(TB.cdm,"physical")}) means ${sname(TB.cdm)} wins shoulder barges and wrestling matches consistently. `;
    if(window.a(TA.st,"physical")>=88)txt+=`${sname(TA.st)}'s physicality (${window.a(TA.st,"physical")}) is a match — can hold off ${sname(TB.cdm)} and play the layoff before being dispossessed. `;
    if((TA.st.traits||[]).includes("linkUpPlay"))txt+=`${sname(TA.st)} is specifically a link-up specialist — dropping deep and receiving between lines is his strength, making him harder to mark than a traditional target man. `;
    if(diff>20)txt+=`<br><br><strong>Verdict:</strong> ${sname(TB.cdm)} completely neutralises ${sname(TA.st)}'s link-up play — ${n0} struggle to get the striker involved.`;
    else if(diff<-15)txt+=`<br><br><strong>Verdict:</strong> ${sname(TA.st)} wins this physical and technical contest — ${n0} can build effectively through their striker.`;
    else txt+=`<br><br><strong>Verdict:</strong> A competitive physical battle throughout.`;

    battles.push({title:`${sname(TB.cdm)} vs ${sname(TA.st)} link-up`,sub:"CDM SCREEN vs ST BUILD-UP",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("TACKLING",window.a(TB.cdm,"tackling"),window.a(TA.st,"physical")),
             statBox("PHYSICAL",window.a(TB.cdm,"physical"),window.a(TA.st,"physical")),
             statBox("POSITIONING",window.a(TB.cdm,"positioning"),window.a(TA.st,"positioning")),
             statBox("INTELLIGENCE",window.a(TB.cdm,"intelligence"),window.a(TA.st,"intelligence"))]});
  }

  // ── BATTLE 9: TRANSITION SHOWDOWN ────────────────────────
  // A's fastest attacker vs B's last line of defence
  const fastAtkA=[TA.lw,TA.rw,TA.st].filter(p=>p).sort((x,y)=>window.a(y,"pace")-window.a(x,"pace"))[0];
  const fastDefB=[TB.lb,TB.rb,...TB.cbs].filter(p=>p).sort((x,y)=>window.a(y,"pace")-window.a(x,"pace"))[0];
  if(fastAtkA&&fastDefB){
    const paceAtk=window.a(fastAtkA,"pace"),paceDef=window.a(fastDefB,"pace");
    const diff=(paceAtk-paceDef)*1.1+(window.a(fastAtkA,"transitionThreat")-60)*0.4;
    const{a:as,b:bs}=bScores(diff);
    const dom=domLabel(as,bs,sname(fastAtkA),sname(fastDefB));
    let txt=`<strong>${sname(fastAtkA)}</strong> (${paceAtk} pace) against <strong>${sname(fastDefB)}</strong> (${paceDef} pace) — the transition battle at the heart of open play.<br><br>`;
    if(paceAtk>93)txt+=`${sname(fastAtkA)}'s pace of ${paceAtk} puts them in a category almost impossible to defend against in open space. Once the ball is played behind the line, there is simply no catching them. `;
    const paceDiff=paceAtk-paceDef;
    if(paceDiff>18)txt+=`A pace gap of ${Math.round(paceDiff)} points is decisive in any open-space race. ${n1}'s defensive line has to play deeper to avoid being caught — this itself hands ${n0} more space to play into. `;
    else if(paceDiff>8)txt+=`A meaningful pace advantage — ${n0} benefit from trying balls in behind regularly. `;
    else if(paceDiff<-5)txt+=`${sname(fastDefB)} is actually quicker and wins the race every time — balls in behind are recovered before they become dangerous. `;
    if(phases.neutralAvsB.transition){
      const tCtx=phases.neutralAvsB.transition;
      if(tCtx.highLineRisk>0.6)txt+=`${n1} are playing a high line — this is critical context that multiplies ${sname(fastAtkA)}'s threat massively. The space behind the defence is enormous and every lost ball is a potential chance. `;
      if(tCtx.fbPushRisk>0.4)txt+=`${n1}'s fullbacks push high, leaving additional space that ${sname(fastAtkA)} can run into. `;
      if(tCtx.cdmProtectionReduction>0.35)txt+=`${n1}'s CDM provides solid protection and reduces the impact of ${sname(fastAtkA)}'s runs by closing passing lanes. `;
    }
    if(window.a(fastDefB,"intelligence")>=88)txt+=`${sname(fastDefB)}'s intelligence (${window.a(fastDefB,"intelligence")}) means they position to cut off the run before it happens — this is the primary weapon against elite pace. `;
    if(diff>30)txt+=`<br><br><strong>Verdict:</strong> ${sname(fastAtkA)} destroys the transition battle — ${n0} score multiple times from quick breaks behind the defensive line.`;
    else if(diff>12)txt+=`<br><br><strong>Verdict:</strong> The transition battle favours ${n0} — the pace advantage translates to real scoring opportunities.`;
    else if(diff>-6)txt+=`<br><br><strong>Verdict:</strong> Evenly matched in transition — the battle is decided by positioning and tactical awareness.`;
    else txt+=`<br><br><strong>Verdict:</strong> ${sname(fastDefB)} and ${n1}'s defence contain the transition threat — the pace advantage is nullified by defensive intelligence.`;

    battles.push({title:`${sname(fastAtkA)} transition vs ${sname(fastDefB)} recovery`,sub:"PACE & TRANSITION SHOWDOWN",a:as,b:bs,dom,narrative:txt,
      stats:[statBox("PACE",paceAtk,paceDef),
             statBox("TRANS THREAT",window.a(fastAtkA,"transitionThreat"),window.a(fastDefB,"defensiveAwareness")),
             statBox("FINISHING",window.a(fastAtkA,"finishing"),window.a(fastDefB,"tackling")),
             statBox("INTELLIGENCE",window.a(fastAtkA,"intelligence"),window.a(fastDefB,"intelligence"))]});
  }

  return battles;
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 10: DEEP TACTICAL BREAKDOWN TEXT
//  Full narrative paragraphs for each phase
// ═══════════════════════════════════════════════════════════════════════════
function deepTacticalBreakdown(phases,n0,n1){
  const TA=phases.TA,TB=phases.TB;
  const CA=phases.CA,CB=phases.CB;
  const synA=phases.synA,synB=phases.synB;
  const sections=[];

  const archDesc={counterAttack:"a fast counter-attacking side",possession:"a possession-based team",highPress:"a high-intensity pressing outfit",direct:"a direct, vertical team",wide:"a wide, crossing-based team",organised:"a compact, organised side"};

  // OVERVIEW
  sections.push({title:"TACTICAL OVERVIEW",wt:null,wc:null,
    text:`<strong>${n0}</strong> set up as ${archDesc[TA.archetype]||"a balanced side"}. <strong>${n1}</strong> as ${archDesc[TB.archetype]||"a balanced side"}.
    ${TA.archetype===TB.archetype?"Both sides share a philosophy — the result comes down to individual quality.":
      TA.archetype==="counterAttack"&&TB.archetype==="possession"?`Classic counter vs possession — ${n0} soak up and strike, ${n1} try to control the ball and starve the game.`:
      TA.archetype==="possession"&&TB.archetype==="counterAttack"?`${n0} must keep the ball away from ${n1}'s dangerous transition players.`:
      `The tactical contrast creates fascinating matchups across the pitch.`}
    ${synA.log.length?`<br><br><strong>${n0} synergies:</strong> ${synA.log.slice(0,2).join(". ")}.`:""}
    ${synB.log.length?`<br><strong>${n1} synergies:</strong> ${synB.log.slice(0,2).join(". ")}.`:""}`
  });

  // ATTACK
  const aAtkWins=phases.aAtk>phases.bAtk;
  sections.push({title:"ATTACK vs DEFENCE",wt:Math.abs(phases.aAtk-phases.bAtk)<3?"DRAW":aAtkWins?n0:n1,wc:Math.abs(phases.aAtk-phases.bAtk)<3?"draw":aAtkWins?"p1":"p2",
    text:`Attack scores: <strong>${n0} ${Math.round(phases.aAtk)}</strong> — <strong>${n1} ${Math.round(phases.bAtk)}</strong>.
    ${TA.stFinishingThreat>88?`${sname(TA.st)}'s finishing threat (${Math.round(TA.stFinishingThreat)}) is elite — every chance counts. `:""}
    ${TB.cbDefAware<70&&TA.stPaceThreat>80?`${n1}'s defensive awareness (${Math.round(TB.cbDefAware)}) is a major concern against ${n0}'s pace. `:""}
    ${CA.totalAttackCohesion>80?`${n0}'s attacking unit works as a cohesive whole — wingers and striker combine beautifully. `:""}
    ${TB.gkShotStopping>86?`${sname(TB.gk)}'s shot-stopping (${Math.round(TB.gkShotStopping)}) is elite and will frustrate ${n0}. `:""}
    <em>Note: attack score calculated from forward and CAM position scores only — not affected by defensive players' overall ratings.</em>`
  });

  // MIDFIELD
  const aMidWins=phases.aMid>phases.bMid;
  sections.push({title:"MIDFIELD BATTLE",wt:Math.abs(phases.aMid-phases.bMid)<3?"DRAW":aMidWins?n0:n1,wc:Math.abs(phases.aMid-phases.bMid)<3?"draw":aMidWins?"p1":"p2",
    text:`Midfield scores: <strong>${n0} ${Math.round(phases.aMid)}</strong> — <strong>${n1} ${Math.round(phases.bMid)}</strong>.
    ${CA.cdmCompensatesForWeakCAM?`${sname(TA.cdm)}'s box-to-box ability compensates for limited creative options elsewhere — the CDM is doing the CAM's job as well as their own. `:""}
    ${CA.effectiveMidfieldCreativity>82?`Midfield creativity is high (${Math.round(CA.effectiveMidfieldCreativity)}) — ${n0} generate more chances through intelligent, incisive play. `:""}
    ${CA.effectivePressResistance>84?`Press resistance (${Math.round(CA.effectivePressResistance)}) means ${n0} can play through pressure comfortably. `:""}
    ${TA.cdmWorkHorse>82?`${sname(TA.cdm)} covers enormous ground — a tireless workhorse who provides both defensive screen and creative launch pad. `:""}
    ${CA.cmDropsToScreen?`${sname(TA.cm)} drops to screen when ${sname(TA.cdm)} pushes forward — intelligent coverage chain that maintains defensive shape. `:""}
    ${Math.abs(phases.aMid-phases.bMid)>18?"The midfield battle is highly one-sided — the dominant side controls the tempo, pace, and direction of the entire match.":""}`
  });

  // TRANSITION
  const aTransWins=phases.aTrans>phases.bTrans;
  const transData=phases.neutralAvsB?.transition;
  sections.push({title:"TRANSITION & COUNTER-ATTACK",wt:Math.abs(phases.aTrans-phases.bTrans)<3?"DRAW":aTransWins?n0:n1,wc:Math.abs(phases.aTrans-phases.bTrans)<3?"draw":aTransWins?"p1":"p2",
    text:`Transition scores: <strong>${n0} ${Math.round(phases.aTrans)}</strong> — <strong>${n1} ${Math.round(phases.bTrans)}</strong>.
    ${transData?`Context multiplier: ${(transData.contextMultiplier*100).toFixed(0)}% — this is how much of the theoretical transition threat is actually activated given ${n1}'s defensive shape. `:""}
    ${transData&&transData.highLineRisk>0.65?`<strong>${n1} play a high defensive line</strong> — this is a critical vulnerability. Every lost ball is a potential sprint in behind for ${n0}'s forwards. `:""}
    ${transData&&transData.fbPushRisk>0.4?`${n1}'s fullbacks push high — creating space in behind that transition runners can exploit. `:""}
    ${transData&&transData.elitePaceBonus>0?`${n0} have ${Math.round(transData.elitePaceBonus/8)} elite-pace forwards (90+) — the transition bonus from this is significant. `:""}
    ${transData&&transData.cdmProtectionReduction>0.35?`${n1}'s CDM screens effectively, reducing the transition danger by covering the space in front of the defence. `:""}
    <em>Transition score is contextual — it is not activated by pace alone, only when defensive shape and positioning create the conditions for it to be dangerous.</em>`
  });

  // WIDE
  const aWideWins=phases.aWide>phases.bWide;
  sections.push({title:"WIDE PLAY",wt:Math.abs(phases.aWide-phases.bWide)<3?"DRAW":aWideWins?n0:n1,wc:Math.abs(phases.aWide-phases.bWide)<3?"draw":aWideWins?"p1":"p2",
    text:`Wide scores: <strong>${n0} ${Math.round(phases.aWide)}</strong> — <strong>${n1} ${Math.round(phases.bWide)}</strong>.
    ${TA.lw?`${n0}'s left: <strong>${sname(TA.lw)}</strong> (${window.a(TA.lw,"pace")} pace, ${window.a(TA.lw,"dribbling")} dribbling) vs ${TB.rb?sname(TB.rb)+" ("+window.a(TB.rb,"pace")+" pace, "+window.a(TB.rb,"defensiveAwareness")+" DA)":"no RB"}. `:""}
    ${TA.rw?`${n0}'s right: <strong>${sname(TA.rw)}</strong> (${window.a(TA.rw,"pace")} pace, ${window.a(TA.rw,"crossing")} crossing) vs ${TB.lb?sname(TB.lb)+" ("+window.a(TB.lb,"pace")+" pace, "+window.a(TB.lb,"tackling")+" tackling)":"no LB"}. `:""}
    ${CA.lwNotTracking?`⚠️ ${sname(TA.lw)} doesn't track back (workRate: ${window.a(TA.lw,"workRate")}) — ${TB.rb?sname(TB.rb):"the RB"} can attack without defensive pressure on that side. `:""}
    ${CA.leftFlankDefGap>8?`⚠️ Left flank defensive gap: ${Math.round(CA.leftFlankDefGap)} — ${sname(TA.lb)}'s attacking tendencies leave this channel exposed. `:""}
    ${CA.rightFlankDefGap>8?`⚠️ Right flank defensive gap: ${Math.round(CA.rightFlankDefGap)} — ${sname(TA.rb)}'s attacking tendencies leave this channel exposed. `:""}`
  });

  // DEFENCE
  const aDefWins=phases.aDefStr>phases.bDefStr;
  sections.push({title:"DEFENSIVE STRUCTURE",wt:Math.abs(phases.aDefStr-phases.bDefStr)<3?"DRAW":aDefWins?n0:n1,wc:Math.abs(phases.aDefStr-phases.bDefStr)<3?"draw":aDefWins?"p1":"p2",
    text:`Defence scores: <strong>${n0} ${Math.round(phases.aDefStr)}</strong> — <strong>${n1} ${Math.round(phases.bDefStr)}</strong>.
    ${TA.cbs.length?`CB partnership: ${TA.cbs.map(c=>sname(c)+"("+window.a(c,"defensiveAwareness")+" DA, "+window.a(c,"pace")+" pace)").join(" + ")}. `:""}
    ${TA.cbPartnershipBonus>=6?`Partnership synergy of +${TA.cbPartnershipBonus} — complementary attributes make them a more effective unit together. `:""}
    ${CA.cdmCanCoverFBs?`${sname(TA.cdm)}'s CDM screen (quality: ${Math.round(TA.cdmScreenQuality)}) covers for attacking fullbacks and protects the backline. `:`⚠️ CDM cover is insufficient — attacking fullbacks create defensive exposure. `}
    ${TA.gkShotStopping>86?`${sname(TA.gk)}'s shot-stopping (${Math.round(TA.gkShotStopping)}) provides a reliable last line. `:""}
    ${CA.leftFlankDefGap+CA.rightFlankDefGap>15?`⚠️ Combined flank exposure of ${Math.round(CA.leftFlankDefGap+CA.rightFlankDefGap)} — this defence can be stretched and gaps will appear. `:""}
    <em>Defence score derived from CB/LB/RB position scores, CDM screen quality, and GK — never impacted by attacking players' ratings.</em>`
  });

  return sections;
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP 11: WEAKNESSES (CONTEXTUAL — only flagged if opponent can exploit)
// ═══════════════════════════════════════════════════════════════════════════
function contextualWeaknesses(T,oppT){
  const w=[];
  // Slow CBs — only if opponent has pace threat
  if(T.cbPace<72&&oppT.attackPace>82){
    const severity=clamp2(oppT.attackPace-T.cbPace,0,35);
    w.push({label:`Slow CBs vs pace (gap: ${Math.round(severity)})`,detail:`CB pace ${Math.round(T.cbPace)} vs opponent attack pace ${Math.round(oppT.attackPace)} — balls in behind repeatedly dangerous. Severity: ${severity>25?"critical":severity>15?"high":"moderate"}.`});
  }
  // CDM screen — only if opponent has transition/CAM threat
  if(T.cdmScreenQuality<65&&(oppT.transitionThreat>78||oppT.camCreativity>80)){
    w.push({label:"Weak CDM screen",detail:`Screen quality ${Math.round(T.cdmScreenQuality)} vs opponent's creative/transition threat — midfield is regularly bypassed.`});
  }
  // Press resistance — only if opponent actually presses
  if(T.teamPressResistance<68&&oppT.teamPressing>76){
    w.push({label:"Low press resistance",detail:`Team press resistance ${Math.round(T.teamPressResistance)} vs opponent pressing ${Math.round(oppT.teamPressing)} — build-up play is frequently disrupted.`});
  }
  // Aerial — only if opponent can cross or threatens from set pieces
  if(T.cbAerial<74&&(oppT.stAerialThreat>78||oppT.camSetPieceThreat>78)){
    w.push({label:"Aerial weakness",detail:`CB aerial average ${Math.round(T.cbAerial)} vs opponent aerial threat ${Math.round(oppT.stAerialThreat)} — set pieces and crossing are a genuine threat.`});
  }
  // Attacking FBs without CDM cover
  if(T.fbCombinedAttackRisk>70&&T.cdmScreenQuality<68){
    w.push({label:"Exposed fullbacks",detail:`Fullback attack risk ${Math.round(T.fbCombinedAttackRisk)} with CDM screen quality only ${Math.round(T.cdmScreenQuality)} — counter-attacks will find space behind the fullbacks.`});
  }
  // GK
  if(T.gkRating<72){w.push({label:"GK below standard",detail:`GK rating ${Math.round(T.gkRating)} — will likely concede from shots that a better keeper would save.`})}
  // Finishing
  if(T.stFinishingThreat<66){w.push({label:"Poor finishing",detail:`ST finishing threat ${Math.round(T.stFinishingThreat)} — chances will be created but conversion rate will be low.`})}
  // Wingers not tracking back
  if(T.lwNotTracking&&T.rwNotTracking){w.push({label:"Wingers not tracking back",detail:"Both wide players have low workRate/defensive awareness — the fullbacks face 2v1s defensively on both flanks."})}
  // No CDM
  if(!T.cdm){w.push({label:"No CDM",detail:"Playing without a defensive midfielder leaves the backline dangerously exposed to through balls and transitions."})}
  // Crossing without aerial target
  if(T.lwCrossingThreat>75&&T.rwCrossingThreat>75&&T.stAerialThreat<68){
    w.push({label:"Crosses without aerial threat",detail:`Crossing quality is good (${Math.round((T.lwCrossingThreat+T.rwCrossingThreat)/2)}) but no dominant aerial target in the box — deliveries go to waste.`});
  }
  return w;
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXPORT TO WINDOW — all functions available globally
// ═══════════════════════════════════════════════════════════════════════════
window.ENGINE={
  calcIndividualThreats,calcCoverageChains,calcThreatNeutralisation,
  calcDynamicSynergy,calcFullPhases,dynamicScoreline,dynamicPlayerRatings,
  dynamicGoalEvents,calcDeepPvP,deepTacticalBreakdown,contextualWeaknesses,
  // utilities
  posScore2,sname,avg2,clamp2,rng2,a,attrCol2,
  firstByRole,allByRole
};
