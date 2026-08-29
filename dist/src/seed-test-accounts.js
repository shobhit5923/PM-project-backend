import bcrypt from 'bcryptjs';
import prisma from './lib/prisma.js';
async function seedTestAccounts() {
    console.log('Seeding demo test accounts...');
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const testAccounts = [
        {
            name: 'Alex (Lost Owner)',
            email: 'alex@gim.ac.in',
            passwordHash,
            phone: '9876543210',
        },
        {
            name: 'Sam (Item Finder)',
            email: 'sam@gim.ac.in',
            passwordHash,
            phone: '9123456789',
        },
        {
            name: 'Demo Student',
            email: 'user@gim.ac.in',
            passwordHash,
            phone: '9988776655',
        },
    ];
    for (const acc of testAccounts) {
        const existing = await prisma.user.findUnique({ where: { email: acc.email } });
        if (!existing) {
            await prisma.user.create({ data: acc });
            console.log(`[CREATED] Account: ${acc.email}`);
        }
        else {
            await prisma.user.update({
                where: { email: acc.email },
                data: { passwordHash: acc.passwordHash },
            });
            console.log(`[UPDATED PASSWORD] Account: ${acc.email}`);
        }
    }
    console.log('Seeding completed successfully!');
}
seedTestAccounts()
    .catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
})
    .then(() => process.exit(0));
