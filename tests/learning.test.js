import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibility,inferTopics,recordLookup,setLearningStatus,removeLearningWord,recordReadingEncounter,trackedAnnotations,migrateHistory} from '../extension/learning.js';
const divine={word:'divine',lemma:'divine',zh:'神圣的',source:'dictionary',rank:4052};
const opts={now:100000,source:'book:page',title:'Faith',interests:['theology']};
test('click eligibility excludes function words; interests and article topics independently qualify specialist words',()=>{
 assert.equal(eligibility({...divine,word:'was',lemma:'be',core:true},['theology']).eligible,false);
 assert.equal(eligibility(divine).eligible,false);
 assert.equal(eligibility(divine,['theology']).eligible,true);
 assert.equal(eligibility(divine,[],inferTopics('Theology','Divine grace and salvation')).eligible,true);
 assert.equal(eligibility({...divine,kind:'entity',core:true},['theology']).eligible,false);
});
test('first eligible click saves; all later matching positions underline; unclicked rare words remain absent',()=>{
 const h={};recordLookup(h,divine,'Divine grace.',opts);
 assert.equal(h.divine.status,'learning');assert.equal(h.divine.saved,true);
 assert.equal(trackedAnnotations('Divine wisdom and divine grace.',h).length,2);
 assert.equal(h.wisdom,undefined);
});
test('same lookup reopen deduplicates; later request returns pending check to consolidation without deleting history',()=>{
 const h={};recordLookup(h,divine,'Divine grace.',opts);setLearningStatus(h,'divine','check');
 recordLookup(h,divine,'Divine grace.',{...opts,now:100100});
 assert.equal(h.divine.lookups.length,1);assert.equal(h.divine.status,'check');
 recordLookup(h,divine,'Divine wisdom.',{...opts,now:100200});
 assert.equal(h.divine.lookups.length,2);assert.equal(h.divine.status,'learning');
});
test('known status is an explicit reader decision; lookup cannot prove forgetting a sense',()=>{
 const h={};recordLookup(h,divine,'Divine grace.',opts);setLearningStatus(h,'divine','known');
 recordLookup(h,divine,'Divine can also be a verb.',{...opts,now:200000});
 assert.equal(h.divine.status,'known');assert.deepEqual(trackedAnnotations('divine',h),[]);
});
test('effective encounters deduplicate same context across sources on the same day; no count certifies mastery',()=>{
 const h={};recordLookup(h,divine,'Divine grace.',opts);
 const now=new Date(2026,9,15,12).getTime();
 assert.equal(recordReadingEncounter(h,'divine','Divine grace.',{now,source:'one'}),true);
 assert.equal(recordReadingEncounter(h,'divine','Divine grace.',{now:now+10000,source:'two'}),true);
 assert.equal(h.divine.readingEncounters.length,1); // another location, same effective context/day
 assert.equal(recordReadingEncounter(h,'divine','Divine wisdom.',{now,source:'one'}),true);
 assert.equal(recordReadingEncounter(h,'divine','Divine grace.',{now:now+86400000}),true);
 assert.equal(h.divine.readingEncounters.length,3);assert.equal(h.divine.status,'learning');
});
test('removal persists through automatic collection but manual keeping restores the word',()=>{
 const h={};recordLookup(h,divine,'Divine grace.',opts);removeLearningWord(h,'divine');
 recordLookup(h,divine,'Divine wisdom.',{...opts,now:200000});
 assert.equal(h.divine.saved,false);setLearningStatus(h,'divine','learning');
 assert.equal(h.divine.saved,true);assert.equal(h.divine.excluded,false);
});
test('legacy migration preserves contexts, saved words, and known statuses',()=>{
 const h={resolve:{lemma:'resolve',saved:true,viewed:true,encounters:['old'],context:'old context'},divine:{...divine,saved:true,status:'known'}};
 migrateHistory(h);assert.equal(h.resolve.status,'learning');assert.deepEqual(h.resolve.encounters,['old']);assert.equal(h.resolve.context,'old context');assert.equal(h.divine.status,'known');
});
test('phrase tracking respects boundaries and matches all occurrences',()=>{
 const h={};recordLookup(h,{word:'at stake',lemma:'at stake',source:'local',kind:'learn',zh:'处于风险中'},'Much is at stake.',opts);
 assert.equal(trackedAnnotations('At stake. More is at stake. Not at stakes.',h).length,2);
});

test('normal English keys that shadow object methods are safe to collect',()=>{
 const h={};recordLookup(h,{word:'constructor',lemma:'constructor',core:true},'A constructor creates an object.',opts);
 assert.equal(h.constructor.saved,true);assert.equal(h.constructor.lookups.length,1);
});
