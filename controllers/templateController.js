const MessageTemplate = require('../models/MessageTemplate');

// Get all templates
exports.getAllTemplates = async (req, res) => {
  try {
    const { platform, category, isActive } = req.query;
    
    let query = {};
    
    if (platform) {
      query.$or = [
        { platform: platform },
        { platform: 'all' }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const templates = await MessageTemplate.find(query).sort({ createdAt: -1 });
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get template by ID
exports.getTemplateById = async (req, res) => {
  try {
    const template = await MessageTemplate.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create new template
exports.createTemplate = async (req, res) => {
  try {
    const template = new MessageTemplate(req.body);
    await template.save();
    
    console.log('✅ Template created:', template.name);
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update template
exports.updateTemplate = async (req, res) => {
  try {
    const template = await MessageTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    console.log('✅ Template updated:', template.name);
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete template
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await MessageTemplate.findByIdAndDelete(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    console.log('✅ Template deleted:', template.name);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
};

// Process template with variables
exports.processTemplate = async (req, res) => {
  try {
    const { templateId, variables } = req.body;
    
    const template = await MessageTemplate.findById(templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    let processedMessage = template.message;
    
    // Replace variables
    if (template.variables && variables) {
      template.variables.forEach(v => {
        const value = variables[v.name] || v.defaultValue || '';
        const regex = new RegExp(v.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processedMessage = processedMessage.replace(regex, value);
      });
    }
    
    res.json({
      template: template,
      processedMessage: processedMessage,
      variables: variables
    });
  } catch (error) {
    console.error('Error processing template:', error);
    res.status(500).json({ error: error.message });
  }
};