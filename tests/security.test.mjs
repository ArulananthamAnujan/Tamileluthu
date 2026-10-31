import test from 'node:test';
import assert from 'node:assert/strict';
import { validPhotoPath, validateSubmission, validatePhoto, MAX_FILE_BYTES, MAX_TOTAL_BYTES } from '../supabase/functions/check-writing/security.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const path=`${owner}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/page-00.jpg`;
const sub={student_id:owner,input_mode:'photo',original_text:null,photo_paths:[path]};
test('accepts only canonical owned photo paths',()=>{
 assert.equal(validPhotoPath(path,owner),true);
 for(const p of [path.replace(owner,other),`${owner}/../${other}/page-00.jpg`,path+'?x',path.replace('/page','/%2e%2e/page'),path.replace(owner,owner+'x')]) assert.equal(validPhotoPath(p,owner),false);
});
test('validates modes, owner, duplicates and page bounds',()=>{
 assert.doesNotThrow(()=>validateSubmission(sub,owner));
 for(const s of [{...sub,student_id:other},{...sub,photo_paths:[path,path]},{...sub,photo_paths:[]},{...sub,photo_paths:Array(11).fill(path)},{...sub,input_mode:'other'},{...sub,original_text:'a'.repeat(20001)}]) assert.throws(()=>validateSubmission(s,owner));
});
test('text mode cannot smuggle photo references',()=>{
 assert.doesNotThrow(()=>validateSubmission({...sub,input_mode:'text',photo_paths:[],original_text:'தமிழ்'},owner));
 assert.throws(()=>validateSubmission({...sub,input_mode:'text',original_text:'தமிழ்'},owner));
 assert.throws(()=>validateSubmission({...sub,input_mode:'text',photo_paths:[],original_text:' '},owner));
});
test('validates media types and byte budgets',()=>{
 assert.equal(validatePhoto({type:'image/jpeg',size:100},0),100);
 for(const f of [{type:'text/html',size:100},{type:'image/jpeg',size:0},{type:'image/jpeg',size:MAX_FILE_BYTES+1}]) assert.throws(()=>validatePhoto(f,0));
 assert.throws(()=>validatePhoto({type:'image/png',size:100},MAX_TOTAL_BYTES-99));
});
