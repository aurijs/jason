import { JSONFilePreset } from 'lowdb/node';
import { bench, describe } from 'vitest';
import { JasonDB as JasonDBMinified } from '../dist';

interface Data {
    posts: { id: string; name: string; email: string; age: number }[]
}

describe('Create 1000 itens', async () => {
    const db = new JasonDBMinified('test_db');
    const col = db.collection('post');

    const lowdb = await JSONFilePreset<Data>('low_db.json', { posts: [] });

    bench('jason', async () => {
        for (let i = 0; i < 1000; i++) {
            col.create({
                id: i.toString(),
                name: `test${i}`,
                email: `test${i}@.com`,
                age: i + 1
            });
        }


    }, { iterations: 10, warmupIterations: 10, time: 100 })

    bench('lowdb', () => {
        for (let i = 0; i < 1000; i++) {
            lowdb.update(({ posts }) => {
                posts.push({
                    id: i.toString(),
                    name: `test${i}`,
                    email: `test${i}@.com`,
                    age: i + 1
                })
            });
        }
    }, { iterations: 10, warmupIterations: 10, time: 100 })

})